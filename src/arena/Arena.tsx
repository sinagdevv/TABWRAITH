import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  RaidTab,
  ClosedTabRecord,
  queryRaidTargets,
  archiveAndCloseTab,
  restoreClosedTab,
  spawnDemoRealTabs,
  isChromeExtensionEnv,
} from '../tabManager/tabManager';
import {
  FloatingTargetCard,
  LaserBeamEffect,
  ParticleBurst,
  createFloatingCards,
  stepFloatingCards,
  findTargetAtPoint,
  createParticleBurst,
} from '../gameEngine/gameEngine';
import { soundFX } from '../gameEngine/soundFX';
import {
  GestureEngine,
  GestureFrameResult,
} from '../gestureEngine/gestureEngine';
import {
  CameraStatus,
  TrackingPerfMetrics,
  initHandLandmarker,
  getActiveDelegate,
  drawHandLandmarks,
} from '../handTracking/handTracker';
import { PixelMonsterSprite, MONSTER_ARCHETYPES } from './PixelMonsterSprite';
import {
  WeaponId,
  WEAPONS,
  WEAPON_BY_ID,
  PixelWeaponSprite,
  PixelBrandLogo,
} from './PixelBrandAndWeapons';

export const Arena: React.FC = () => {
  // Game & Mode states
  const [raidStarted, setRaidStarted] = useState<boolean>(false);
  const [liveMode, setLiveMode] = useState<boolean>(false); // Defaults to SAFE MODE
  const [usingRealTabs, setUsingRealTabs] = useState<boolean>(false);
  const [cards, setCards] = useState<FloatingTargetCard[]>([]);
  const [archivedCount, setArchivedCount] = useState<number>(0);
  const [defeatedCount, setDefeatedCount] = useState<number>(0);
  const [score, setScore] = useState<number>(0); // Lifetime score
  const [credits, setCredits] = useState<number>(0); // Spendable armory credits
  const [combo, setCombo] = useState<number>(1);
  const [closedHistory, setClosedHistory] = useState<ClosedTabRecord[]>([]);
  const [statusBanner, setStatusBanner] = useState<string>(
    'SAFE MODE ACTIVE — MONSTER DEFEATS ARE SIMULATED UNTIL LIVE MODE IS ARMED'
  );
  const [muted, setMuted] = useState<boolean>(false);
  const [spriteFrame, setSpriteFrame] = useState<0 | 1>(0);
  const [screenShake, setScreenShake] = useState<'none' | 'light' | 'boss'>('none');
  const [crosshairRecoil, setCrosshairRecoil] = useState<boolean>(false);
  const [camExpanded, setCamExpanded] = useState<boolean>(false);

  // Armory & Popover states
  const [equippedWeaponId, setEquippedWeaponId] = useState<WeaponId>('starter-blaster');
  const [unlockedWeapons, setUnlockedWeapons] = useState<WeaponId[]>(['starter-blaster']);
  const [armoryOpen, setArmoryOpen] = useState<boolean>(false);
  const [threatInfoOpen, setThreatInfoOpen] = useState<boolean>(false);
  const [showPerfOverlay, setShowPerfOverlay] = useState<boolean>(true);

  // Camera & Hand Tracking states (throttled to avoid per-frame React re-renders)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [gestureState, setGestureState] = useState<GestureFrameResult>({
    handDetected: false,
    isFingerGunPose: false,
    thumbCocked: false,
    thumbFiredThisFrame: false,
    cooldownProgress: 0,
    crosshairX: 0.5,
    crosshairY: 0.5,
    statusLabel: 'NO HAND',
    detailHint: 'RAISE HAND IN VIEW OF CAMERA',
    poseConfidence: 0,
  });

  const [perfMetrics, setPerfMetrics] = useState<TrackingPerfMetrics>({
    cameraFps: 0,
    trackingFps: 0,
    inferenceMs: 0,
    delegate: 'GPU',
    gestureState: 'NO HAND',
  });

  // Currently locked target ID (only updates state when lock target changes)
  const [lockedTabId, setLockedTabId] = useState<number | null>(null);
  const lockedTabIdRef = useRef<number | null>(null);

  const [controlSource, setControlSource] = useState<'mouse' | 'hand'>('mouse');
  const controlSourceRef = useRef<'mouse' | 'hand'>('mouse');

  const [lasers, setLasers] = useState<LaserBeamEffect[]>([]);
  const [bursts, setBursts] = useState<ParticleBurst[]>([]);

  // Refs for zero-lag direct DOM manipulation & animation loops
  const stageRef = useRef<HTMLElement | null>(null);
  const crosshairDomRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<FloatingTargetCard[]>([]);
  cardsRef.current = cards;

  // Stage-local crosshair coordinates stored in ref for 0-lag updates
  const crosshairRef = useRef<{ x: number; y: number }>({ x: 480, y: 320 });

  const liveModeRef = useRef<boolean>(liveMode);
  liveModeRef.current = liveMode;

  const raidStartedRef = useRef<boolean>(raidStarted);
  raidStartedRef.current = raidStarted;

  const comboRef = useRef<number>(combo);
  comboRef.current = combo;

  const equippedWeaponRef = useRef<WeaponId>(equippedWeaponId);
  equippedWeaponRef.current = equippedWeaponId;

  // Prevent duplicate credit/closure rewards on rapid shots
  const defeatedIdsSetRef = useRef<Set<number>>(new Set());

  const wasCockedAudioRef = useRef<boolean>(false);
  const trackingActiveRef = useRef<boolean>(false);
  const inferenceBusyRef = useRef<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gestureEngineRef = useRef<GestureEngine>(new GestureEngine());
  const fireShotRef = useRef<
    (aimStageX: number, aimStageY: number, source: 'hand' | 'mouse' | 'keyboard') => void
  >(() => {});

  const getStageSize = () => {
    const el = stageRef.current;
    if (!el) return { w: 950, h: 640 };
    return { w: el.clientWidth || 950, h: el.clientHeight || 640 };
  };

  // Direct DOM crosshair transform update — zero React re-render latency
  const updateCrosshairPosition = useCallback((stageX: number, stageY: number) => {
    crosshairRef.current = { x: stageX, y: stageY };
    if (crosshairDomRef.current) {
      crosshairDomRef.current.style.transform = `translate3d(${stageX}px, ${stageY}px, 0)`;
    }

    const { w: stageW, h: stageH } = getStageSize();
    const hit = findTargetAtPoint(cardsRef.current, stageX, stageY, stageW, stageH, 30);
    const nextLockedId = hit ? hit.tab.id : null;
    if (nextLockedId !== lockedTabIdRef.current) {
      lockedTabIdRef.current = nextLockedId;
      setLockedTabId(nextLockedId);
    }
  }, []);

  // Load real or fallback tabs
  const loadTabs = useCallback(async () => {
    const { tabs, usingRealTabs: isReal } = await queryRaidTargets();
    defeatedIdsSetRef.current.clear();
    setUsingRealTabs(isReal);
    setCards(createFloatingCards(tabs));
  }, []);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);

  // 2-frame crisp pixel idle animation clock (360ms tick)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSpriteFrame((prev) => (prev === 0 ? 1 : 0));
    }, 360);
    return () => clearInterval(timer);
  }, []);

  const handleRefreshTargets = async () => {
    await loadTabs();
    setStatusBanner('RESCANNED BROWSER TABS // MONSTERS MATERIALIZED');
  };

  // Purchase or Equip Weapon in Armory
  const handleSelectOrBuyWeapon = (weaponId: WeaponId) => {
    const spec = WEAPON_BY_ID[weaponId];
    if (unlockedWeapons.includes(weaponId)) {
      setEquippedWeaponId(weaponId);
      soundFX.playGunReady();
      setStatusBanner(`EQUIPPED ${spec.name.toUpperCase()} (${spec.damage} HP DMG)`);
      return;
    }

    if (credits < spec.cost) {
      soundFX.playMiss();
      setStatusBanner(`INSUFFICIENT CREDITS FOR ${spec.name.toUpperCase()} (NEED ${spec.cost} CR)`);
      return;
    }

    setCredits((prev) => Math.max(0, prev - spec.cost));
    setUnlockedWeapons((prev) => [...prev, weaponId]);
    setEquippedWeaponId(weaponId);
    soundFX.playWeaponUpgrade();
    setStatusBanner(
      `UNLOCKED & EQUIPPED ${spec.name.toUpperCase()} (-${spec.cost} CR // ${spec.damage} DMG)`
    );
  };

  // Core Shooting Mechanic with Weapon Damage (1 / 2 / 3 HP) & Final-Hit Closure
  const fireShot = useCallback(
    async (aimStageX: number, aimStageY: number, source: 'hand' | 'mouse' | 'keyboard') => {
      const { w: stageW, h: stageH } = getStageSize();
      const originX = stageW * 0.5;
      const originY = stageH - 12;

      const weapon = WEAPON_BY_ID[equippedWeaponRef.current];

      setCrosshairRecoil(true);
      setTimeout(() => setCrosshairRecoil(false), 110);

      const hitCard = findTargetAtPoint(cardsRef.current, aimStageX, aimStageY, stageW, stageH, 30);
      const beamId = `beam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      soundFX.playLaser(weapon.level);

      if (!hitCard || defeatedIdsSetRef.current.has(hitCard.tab.id)) {
        soundFX.playMiss();
        setCombo(1);
        setLasers((prev) => [
          ...prev.slice(-6),
          {
            id: beamId,
            fromX: originX,
            fromY: originY,
            toX: aimStageX,
            toY: aimStageY,
            hit: false,
            color: weapon.laserColor,
            coreColor: weapon.coreColor,
            width: Math.max(3, weapon.beamWidth - 2),
            createdAt: Date.now(),
          },
        ]);
        return;
      }

      const targetCenterX = (hitCard.x / 100) * stageW;
      const targetCenterY = (hitCard.y / 100) * stageH;
      const dmg = weapon.damage;
      const nextHp = Math.max(0, hitCard.hp - dmg);
      const isBoss = hitCard.archetype.tier === 5;

      setLasers((prev) => [
        ...prev.slice(-6),
        {
          id: beamId,
          fromX: originX,
          fromY: originY,
          toX: targetCenterX,
          toY: targetCenterY,
          hit: true,
          color: weapon.laserColor,
          coreColor: weapon.coreColor,
          width: weapon.beamWidth,
          createdAt: Date.now(),
        },
      ]);

      // Non-lethal hit: damage flash, recoil, HP reduction, NO tab closure
      if (nextHp > 0) {
        if (isBoss || dmg >= 2) {
          soundFX.playBossDamage();
        } else {
          soundFX.playMonsterHit();
        }

        const now = Date.now();
        setCards((prev) =>
          prev.map((c) =>
            c.tab.id === hitCard.tab.id
              ? {
                  ...c,
                  hp: nextHp,
                  hitFlashUntil: now + 150,
                  recoilOffsetY: -12,
                }
              : c
          )
        );

        setBursts((prev) => [
          ...prev.slice(-8),
          createParticleBurst(
            targetCenterX,
            targetCenterY,
            hitCard.archetype.tier,
            `-${dmg} HP (${nextHp}/${hitCard.maxHp})`,
            weapon.name.toUpperCase(),
            false
          ),
        ]);

        setStatusBanner(
          `${weapon.name.toUpperCase()} HIT ${hitCard.archetype.name.toUpperCase()} (-${dmg} HP -> ${nextHp}/${hitCard.maxHp} HP)`
        );
        return;
      }

      // Lethal hit (nextHp === 0): Guard against duplicate kill rewards/closures
      if (defeatedIdsSetRef.current.has(hitCard.tab.id)) {
        return;
      }
      defeatedIdsSetRef.current.add(hitCard.tab.id);

      soundFX.playMonsterDeath(isBoss);

      const currentCombo = comboRef.current;
      if (currentCombo > 1) {
        soundFX.playCombo(currentCombo);
      }

      setCards((prev) =>
        prev.map((c) =>
          c.tab.id === hitCard.tab.id
            ? { ...c, hp: 0, isDestroying: true, hitFlashUntil: Date.now() + 200 }
            : c
        )
      );

      setScreenShake(isBoss ? 'boss' : 'light');
      setTimeout(() => setScreenShake('none'), isBoss ? 250 : 130);

      const result = await archiveAndCloseTab(hitCard.tab, liveModeRef.current);

      if (!result.success) {
        // Safety rollback: keep monster alive at 1 HP if bookmarking failed
        defeatedIdsSetRef.current.delete(hitCard.tab.id);
        setCards((prev) =>
          prev.map((c) =>
            c.tab.id === hitCard.tab.id ? { ...c, hp: 1, isDestroying: false } : c
          )
        );
        setStatusBanner(`SAFETY ABORT: ${result.error}`);
        return;
      }

      const baseCreditsEarned = hitCard.points;
      const scoreEarned = hitCard.points * currentCombo;

      setBursts((prev) => [
        ...prev.slice(-8),
        createParticleBurst(
          targetCenterX,
          targetCenterY,
          hitCard.archetype.tier,
          `+${scoreEarned} PTS // +${baseCreditsEarned} CR`,
          liveModeRef.current && !hitCard.tab.isMock ? 'ARCHIVED & CLOSED' : 'DEFEATED (SAFE)',
          true
        ),
      ]);

      setScore((prev) => prev + scoreEarned);
      setCredits((prev) => prev + baseCreditsEarned);
      setCombo((prev) => Math.min(8, prev + 1));
      setArchivedCount((prev) => prev + 1);
      setDefeatedCount((prev) => prev + 1);

      if (result.record) {
        setClosedHistory((prev) => [result.record!, ...prev]);
      }

      setStatusBanner(
        `${source.toUpperCase()} KILL: ${hitCard.archetype.name.toUpperCase()} (+${baseCreditsEarned} CR) — ${
          liveModeRef.current && !hitCard.tab.isMock
            ? 'BOOKMARKED & TAB CLOSED'
            : 'SIMULATED DEFEAT (SAFE MODE)'
        }`
      );

      const remainingAfter = cardsRef.current.filter(
        (c) => c.tab.id !== hitCard.tab.id && !c.isDestroying
      ).length;
      if (remainingAfter === 0) {
        setTimeout(() => soundFX.playVictory(), 180);
      }

      setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.tab.id !== hitCard.tab.id));
      }, 210);
    },
    []
  );

  fireShotRef.current = fireShot;

  // Undo last defeated tab
  const handleUndo = async () => {
    if (closedHistory.length === 0) return;
    const [latest, ...rest] = closedHistory;
    setClosedHistory(rest);

    soundFX.playRestore();
    const restoredTab: RaidTab = await restoreClosedTab(latest, liveMode);
    defeatedIdsSetRef.current.delete(restoredTab.id);

    setCards((prev) => {
      const restoredCards = createFloatingCards([restoredTab]);
      return [...prev, ...restoredCards];
    });
    setArchivedCount((prev) => Math.max(0, prev - 1));
    setDefeatedCount((prev) => Math.max(0, prev - 1));
    setStatusBanner(`UNDO: "${restoredTab.title.slice(0, 44)}" RESTORED AT FULL HP`);
  };

  // Floating monsters & VFX cleanup animation loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const startTime = lastTime;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      const elapsed = (now - startTime) / 1000;
      lastTime = now;

      setCards((prev) => {
        if (prev.length === 0) return prev;
        const next = stepFloatingCards(prev, dt, elapsed);
        cardsRef.current = next;
        return next;
      });

      // Keep lock indicator synced as monsters drift under stationary crosshair
      const { w: stageW, h: stageH } = getStageSize();
      const hit = findTargetAtPoint(
        cardsRef.current,
        crosshairRef.current.x,
        crosshairRef.current.y,
        stageW,
        stageH,
        30
      );
      const nextLockedId = hit ? hit.tab.id : null;
      if (nextLockedId !== lockedTabIdRef.current) {
        lockedTabIdRef.current = nextLockedId;
        setLockedTabId(nextLockedId);
      }

      const wallNow = Date.now();
      setLasers((prev) =>
        prev.some((l) => wallNow - l.createdAt > 210)
          ? prev.filter((l) => wallNow - l.createdAt <= 210)
          : prev
      );
      setBursts((prev) =>
        prev.some((b) => wallNow - b.createdAt > 680)
          ? prev.filter((b) => wallNow - b.createdAt <= 680)
          : prev
      );

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Disable Webcam cleanly
  const disableCamera = useCallback(() => {
    trackingActiveRef.current = false;
    inferenceBusyRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (landmarkCanvasRef.current) {
      const ctx = landmarkCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, landmarkCanvasRef.current.width, landmarkCanvasRef.current.height);
    }
    setCameraStatus('idle');
    controlSourceRef.current = 'mouse';
    setControlSource('mouse');
    setGestureState((prev) => ({
      ...prev,
      handDetected: false,
      isFingerGunPose: false,
      thumbCocked: false,
      thumbFiredThisFrame: false,
      statusLabel: 'NO HAND',
      detailHint: 'CAMERA STANDBY // MOUSE & [SPACE] ACTIVE',
    }));
    setPerfMetrics((prev) => ({
      ...prev,
      cameraFps: 0,
      trackingFps: 0,
      inferenceMs: 0,
      gestureState: 'NO HAND',
    }));
    setStatusBanner('CAMERA DISABLED — MOUSE & [SPACE] CONTROLS ACTIVE');
  }, []);

  // Enable Webcam + Optimized Zero-Overlap MediaPipe Pipeline
  const enableCamera = async () => {
    if (
      cameraStatus === 'active' ||
      cameraStatus === 'requesting' ||
      cameraStatus === 'loading-model'
    ) {
      return;
    }

    setCameraError(null);
    setCameraStatus('requesting');

    try {
      // 480x360 @ 30fps minimizes USB/decode/WASM copy latency while matching the 4:3 preview
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus('loading-model');
      setStatusBanner('INITIALIZING LOCAL MEDIAPIPE HAND TRACKER...');

      const landmarker = await initHandLandmarker();
      gestureEngineRef.current.reset();
      trackingActiveRef.current = true;
      inferenceBusyRef.current = false;

      setCameraStatus('active');
      controlSourceRef.current = 'hand';
      setControlSource('hand');
      setStatusBanner('CAMERA ONLINE // AIM WITH INDEX FINGER, FOLD THUMB TO SHOOT');

      let lastMediaTime = -1;
      let lastInferenceTimestamp = -1;
      let camFramesCount = 0;
      let trackFramesCount = 0;
      let latestInferMs = 0;
      let lastPerfCommitTime = performance.now();
      let lastGestureStatusCommitted = '';
      let lastCockedCommitted = false;

      const processVideoFrame = (nowMs: number, mediaTime?: number) => {
        if (!trackingActiveRef.current) return;
        const video = videoRef.current;
        const canvas = landmarkCanvasRef.current;

        if (!video || !streamRef.current || !streamRef.current.active) {
          return;
        }

        const currentVideoTime = mediaTime ?? video.currentTime;
        if (video.readyState >= 2 && currentVideoTime !== lastMediaTime) {
          lastMediaTime = currentVideoTime;
          camFramesCount++;

          // Never overlap inference calls; ensure strictly monotonic timestamp for MediaPipe VIDEO mode
          if (!inferenceBusyRef.current) {
            inferenceBusyRef.current = true;
            const inferStart = performance.now();
            const safeTimestamp = Math.max(
              lastInferenceTimestamp + 1,
              Math.floor(inferStart)
            );
            lastInferenceTimestamp = safeTimestamp;

            try {
              const detections = landmarker.detectForVideo(video, safeTimestamp);
              latestInferMs = performance.now() - inferStart;
              trackFramesCount++;

              const firstHand = detections.landmarks?.[0] ?? null;
              const frameResult = gestureEngineRef.current.processLandmarks(
                firstHand,
                inferStart
              );

              if (
                frameResult.isFingerGunPose &&
                frameResult.thumbCocked &&
                !wasCockedAudioRef.current
              ) {
                soundFX.playGunReady();
              }
              wasCockedAudioRef.current =
                frameResult.isFingerGunPose && frameResult.thumbCocked;

              if (canvas) {
                drawHandLandmarks(
                  canvas,
                  firstHand,
                  frameResult.isFingerGunPose,
                  frameResult.thumbCocked
                );
              }

              // Direct DOM crosshair update on every tracked frame (0 React re-render overhead)
              if (frameResult.handDetected) {
                const { w: stageW, h: stageH } = getStageSize();
                const nextX = frameResult.crosshairX * stageW;
                const nextY = frameResult.crosshairY * stageH;

                if (controlSourceRef.current !== 'hand') {
                  controlSourceRef.current = 'hand';
                  setControlSource('hand');
                }

                updateCrosshairPosition(nextX, nextY);

                if (frameResult.thumbFiredThisFrame && raidStartedRef.current) {
                  fireShotRef.current(nextX, nextY, 'hand');
                }
              }

              // Only commit React state when gesture status label or cocked state changes
              if (
                frameResult.statusLabel !== lastGestureStatusCommitted ||
                frameResult.thumbCocked !== lastCockedCommitted ||
                frameResult.thumbFiredThisFrame
              ) {
                lastGestureStatusCommitted = frameResult.statusLabel;
                lastCockedCommitted = frameResult.thumbCocked;
                setGestureState(frameResult);
              }
            } finally {
              inferenceBusyRef.current = false;
            }
          }
        }

        // Commit performance telemetry at ~2.5Hz so HUD shows accurate FPS/ms without React churn
        const elapsedPerfWindow = nowMs - lastPerfCommitTime;
        if (elapsedPerfWindow >= 400) {
          const camFps = Math.round((camFramesCount * 1000) / elapsedPerfWindow);
          const trackFps = Math.round((trackFramesCount * 1000) / elapsedPerfWindow);
          camFramesCount = 0;
          trackFramesCount = 0;
          lastPerfCommitTime = nowMs;

          setPerfMetrics({
            cameraFps: camFps,
            trackingFps: trackFps,
            inferenceMs: Math.round(latestInferMs * 10) / 10,
            delegate: getActiveDelegate(),
            gestureState: lastGestureStatusCommitted || 'NO HAND',
          });
        }

        scheduleNextFrame();
      };

      const scheduleNextFrame = () => {
        if (!trackingActiveRef.current || !videoRef.current) return;
        const vid = videoRef.current as HTMLVideoElement & {
          requestVideoFrameCallback?: (
            cb: (now: number, meta: { mediaTime: number }) => void
          ) => number;
        };

        if (typeof vid.requestVideoFrameCallback === 'function') {
          vid.requestVideoFrameCallback((now, meta) => {
            processVideoFrame(now, meta.mediaTime);
          });
        } else {
          requestAnimationFrame((now) => {
            processVideoFrame(now);
          });
        }
      };

      scheduleNextFrame();
    } catch (err) {
      trackingActiveRef.current = false;
      const msg = err instanceof Error ? err.message : 'Camera permission denied or unavailable';
      const isDenied =
        msg.toLowerCase().includes('denied') ||
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('notallowed');
      setCameraStatus(isDenied ? 'denied' : 'error');
      setCameraError(msg);
      setStatusBanner('CAMERA UNAVAILABLE — MOUSE AIM & [SPACE] / CLICK ACTIVE');
    }
  };

  useEffect(() => {
    return () => {
      trackingActiveRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Spacebar fallback shooting
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && raidStartedRef.current) {
        if (
          document.activeElement instanceof HTMLElement &&
          document.activeElement.tagName === 'BUTTON'
        ) {
          document.activeElement.blur();
        }
        e.preventDefault();
        fireShotRef.current(crosshairRef.current.x, crosshairRef.current.y, 'keyboard');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Stage mouse aiming & click fallback (direct DOM crosshair update)
  const handleStageMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const localY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    if (!gestureState.handDetected || controlSourceRef.current === 'mouse') {
      updateCrosshairPosition(localX, localY);
    } else if (Math.abs(e.movementX) + Math.abs(e.movementY) > 10) {
      controlSourceRef.current = 'mouse';
      setControlSource('mouse');
      updateCrosshairPosition(localX, localY);
    }
  };

  const handleStageClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!raidStarted) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-hud-interactive="true"]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const localX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const localY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    controlSourceRef.current = 'mouse';
    setControlSource('mouse');
    updateCrosshairPosition(localX, localY);
    fireShot(localX, localY, 'mouse');
  };

  const toggleLiveMode = () => {
    setLiveMode((prev) => {
      const next = !prev;
      setStatusBanner(
        next
          ? 'LIVE MODE ARMED — FINAL BLOW BOOKMARKS & CLOSES THE REAL TAB'
          : 'SAFE MODE ACTIVE — REAL TABS ARE PROTECTED'
      );
      return next;
    });
  };

  const toggleMute = () => {
    soundFX.muted = !muted;
    setMuted(!muted);
  };

  const equippedWeapon = WEAPON_BY_ID[equippedWeaponId];
  const lockedCard = cards.find((c) => !c.isDestroying && c.tab.id === lockedTabId) || null;
  const activeCardsCount = cards.filter((c) => !c.isDestroying).length;
  const nowWall = Date.now();

  return (
    <div
      className={`arena-root ${
        screenShake === 'boss'
          ? 'shake-boss'
          : screenShake === 'light'
          ? 'shake-light'
          : ''
      }`}
    >
      {/* TOP RETRO ARCADE HUD */}
      <header className="hud-topbar" data-hud-interactive="true">
        <div className="hud-brand">
          <PixelBrandLogo size={36} />
          <div>
            <div className="hud-title-row">
              <h1 className="hud-title">TAB RAID</h1>
              <span className="hud-title-sub">MONSTER INVASION</span>
            </div>
            <p className="hud-status-line">{statusBanner}</p>
          </div>
        </div>

        <div className="hud-metrics" role="region" aria-label="Arcade Telemetry">
          <div className="metric-box">
            <span className="metric-label">MONSTERS</span>
            <span className="metric-value" data-testid="remaining-count">
              {activeCardsCount}
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">SCORE</span>
            <span className="metric-value metric-lime" data-testid="score-value">
              {score.toString().padStart(6, '0')}
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">CREDITS</span>
            <span className="metric-value metric-amber" data-testid="credits-value">
              {credits} CR
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">COMBO</span>
            <span className="metric-value" data-testid="combo-value">
              {combo}x
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">ARCHIVED</span>
            <span className="metric-value metric-cyan" data-testid="archived-count">
              {archivedCount}
            </span>
          </div>
        </div>

        <div className="hud-actions">
          {/* ARMORY UPGRADE BUTTON */}
          <button
            type="button"
            className={`hud-btn hud-btn-armory ${armoryOpen ? 'armory-active' : ''}`}
            onClick={() => {
              setArmoryOpen((prev) => !prev);
              setThreatInfoOpen(false);
            }}
            data-testid="armory-toggle-btn"
            title="Open Pixel Armory to upgrade weapon damage"
          >
            <PixelWeaponSprite weaponId={equippedWeaponId} size={24} />
            <span>ARMORY ({equippedWeapon.damage}DMG)</span>
          </button>

          <button
            type="button"
            className={`hud-btn mode-toggle ${liveMode ? 'mode-live' : 'mode-safe'}`}
            onClick={toggleLiveMode}
            data-testid="mode-toggle-btn"
            title="SAFE MODE simulates defeats; LIVE MODE bookmarks & closes the real tab on final HP=0"
          >
            <span className="status-dot" />
            {liveMode ? 'LIVE MODE' : 'SAFE MODE'}
          </button>

          <button
            type="button"
            className="hud-btn"
            onClick={handleUndo}
            disabled={closedHistory.length === 0}
            data-testid="undo-btn"
            title="Undo and restore the last defeated tab"
          >
            UNDO ({closedHistory.length})
          </button>

          <button
            type="button"
            className="hud-btn"
            onClick={handleRefreshTargets}
            data-testid="rescan-btn"
            title="Rescan open browser tabs"
          >
            RESCAN
          </button>

          <button
            type="button"
            className="hud-btn"
            onClick={toggleMute}
            data-testid="sfx-toggle-btn"
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted ? 'SFX: OFF' : 'SFX: ON'}
          </button>
        </div>
      </header>

      {/* MAIN SPLIT WORKSPACE: 70% MONSTER ARENA / 30% LIVE CAMERA PANEL */}
      <div className="arena-workspace">
        {/* CENTER 70%: MONSTER ARENA STAGE */}
        <main
          ref={stageRef}
          className="arena-stage"
          aria-label="Pixel Monster Arena"
          onMouseMove={handleStageMouseMove}
          onClick={handleStageClick}
        >
          <div className="arena-scanlines" aria-hidden="true" />

          {/* IN-GAME PIXEL ARMORY POPOVER PANEL */}
          {armoryOpen && (
            <div
              className="armory-drawer"
              data-hud-interactive="true"
              data-testid="armory-panel"
            >
              <div className="armory-header">
                <div>
                  <span className="armory-title">PIXEL ARMORY // WEAPON UPGRADES</span>
                  <span className="armory-sub">
                    SPEND CREDITS WITHOUT REDUCING LIFETIME SCORE
                  </span>
                </div>
                <div className="armory-header-right">
                  <span className="armory-balance" data-testid="armory-credits">
                    AVAILABLE: {credits} CR
                  </span>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() => setArmoryOpen(false)}
                    data-testid="armory-close-btn"
                  >
                    CLOSE [X]
                  </button>
                </div>
              </div>

              <div className="armory-grid">
                {WEAPONS.map((w) => {
                  const isUnlocked = unlockedWeapons.includes(w.id);
                  const isEquipped = equippedWeaponId === w.id;
                  const canAfford = credits >= w.cost;

                  return (
                    <div
                      key={w.id}
                      data-testid={`weapon-card-${w.id}`}
                      className={`weapon-card ${isEquipped ? 'weapon-equipped' : ''}`}
                    >
                      <div className="weapon-card-top">
                        <span className="weapon-lvl">LVL {w.level}</span>
                        <span
                          className="weapon-dmg-badge"
                          style={{ color: w.laserColor, borderColor: w.laserColor }}
                        >
                          {w.damage} HP DMG
                        </span>
                      </div>

                      <div className="weapon-sprite-box">
                        <PixelWeaponSprite weaponId={w.id} size={64} />
                      </div>

                      <div className="weapon-name">{w.name}</div>
                      <p className="weapon-desc">{w.tagline}</p>

                      <button
                        type="button"
                        data-testid={`weapon-action-${w.id}`}
                        className={`hud-btn full-width-btn ${
                          isEquipped
                            ? 'hud-btn-lime'
                            : isUnlocked
                            ? 'mode-safe'
                            : canAfford
                            ? 'hud-btn-lime'
                            : ''
                        }`}
                        disabled={!isUnlocked && !canAfford}
                        onClick={() => handleSelectOrBuyWeapon(w.id)}
                      >
                        {isEquipped
                          ? 'EQUIPPED'
                          : isUnlocked
                          ? 'EQUIP WEAPON'
                          : canAfford
                          ? `UNLOCK (${w.cost} CR)`
                          : `NEED ${w.cost} CR`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FLOATING PIXEL MONSTERS */}
          {cards.map((card) => {
            const isLocked = lockedCard?.tab.id === card.tab.id;
            const isHitFlashing = nowWall < card.hitFlashUntil;
            const initialLetter = (card.tab.domain[0] || 'T').toUpperCase();
            const projectedRemainingHp = Math.max(0, card.hp - equippedWeapon.damage);

            return (
              <div
                key={card.tab.id}
                data-testid={`target-card-${card.tab.id}`}
                data-archetype={card.archetype.id}
                data-hp={card.hp}
                className={`monster-unit tier-${card.archetype.tier} ${
                  isLocked ? 'monster-locked' : ''
                } ${isHitFlashing ? 'monster-hit-flash' : ''} ${
                  card.isDestroying ? 'monster-destroying' : ''
                }`}
                style={{
                  left: `${card.x}%`,
                  top: `${card.y}%`,
                  width: `${card.widthPx}px`,
                  transform: `translate(-50%, calc(-50% + ${card.recoilOffsetY}px))`,
                }}
              >
                {/* PIXEL HP BAR WITH PROJECTED WEAPON DAMAGE HIGHLIGHT */}
                <div className="monster-hud-top">
                  <div className="monster-meta-row">
                    <span className="monster-archetype-tag">{card.archetype.name}</span>
                    <span className="monster-threat-tag" title="Estimated Resource Threat Tier">
                      EST. T{card.archetype.tier}
                    </span>
                  </div>
                  <div
                    className="pixel-hp-bar"
                    role="progressbar"
                    aria-valuenow={card.hp}
                    aria-valuemin={0}
                    aria-valuemax={card.maxHp}
                  >
                    {Array.from({ length: card.maxHp }, (_, segIdx) => {
                      const filled = segIdx < card.hp;
                      const isProjectedDamage =
                        isLocked && filled && segIdx >= projectedRemainingHp;
                      return (
                        <span
                          key={segIdx}
                          className={`hp-seg ${filled ? 'hp-seg-filled' : 'hp-seg-empty'} ${
                            isProjectedDamage ? 'hp-seg-projected' : ''
                          } ${card.hp === 1 && filled ? 'hp-seg-critical' : ''}`}
                        />
                      );
                    })}
                    <span className="hp-numeric">
                      {isLocked
                        ? `${card.hp}->${projectedRemainingHp}`
                        : `${card.hp}/${card.maxHp}`}
                    </span>
                  </div>
                </div>

                {/* PROCEDURAL PIXEL ART SPRITE */}
                <div className="monster-sprite-stage">
                  {isLocked && (
                    <div className="target-reticle-brackets">
                      <span className="lock-dmg-callout">
                        {projectedRemainingHp === 0
                          ? 'LETHAL LOCK'
                          : `-${equippedWeapon.damage} DMG`}
                      </span>
                    </div>
                  )}
                  <PixelMonsterSprite
                    tier={card.archetype.tier}
                    seedId={card.tab.id}
                    frame={spriteFrame}
                    isHitFlashing={isHitFlashing}
                    isLocked={isLocked}
                  />
                </div>

                {/* COMPACT REAL TAB IDENTITY NAMEPLATE */}
                <div className="monster-nameplate">
                  <div className="nameplate-top">
                    <span className="nameplate-favicon">
                      {card.tab.favIconUrl ? (
                        <img
                          src={card.tab.favIconUrl}
                          alt=""
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="favicon-letter">{initialLetter}</span>
                      )}
                    </span>
                    <span className="nameplate-domain">{card.tab.domain}</span>
                    <span className="nameplate-pts">+{card.points}CR</span>
                  </div>
                  <div className="nameplate-title" title={card.tab.title}>
                    {card.tab.title}
                  </div>
                </div>
              </div>
            );
          })}

          {/* PIXEL LASER TRAJECTORIES (WEAPON-SCALED COLOR & THICKNESS) */}
          <svg className="arena-vfx-svg" aria-hidden="true">
            {lasers.map((beam) => (
              <g key={beam.id}>
                <line
                  x1={beam.fromX}
                  y1={beam.fromY}
                  x2={beam.toX}
                  y2={beam.toY}
                  stroke={beam.hit ? beam.color : '#64748B'}
                  strokeWidth={beam.width}
                  strokeDasharray="12 4"
                />
                <line
                  x1={beam.fromX}
                  y1={beam.fromY}
                  x2={beam.toX}
                  y2={beam.toY}
                  stroke={beam.coreColor}
                  strokeWidth={Math.max(2, Math.floor(beam.width * 0.4))}
                />
              </g>
            ))}
          </svg>

          {/* PIXEL PARTICLE BURSTS & FLOATING DAMAGE/SCORE NUMBERS */}
          {bursts.map((burst) => (
            <div
              key={burst.id}
              className={`particle-burst ${burst.isBoss ? 'burst-boss' : ''}`}
              style={{ left: burst.x, top: burst.y }}
            >
              {burst.label && (
                <div className="burst-score-pop">
                  <div>{burst.label}</div>
                  {burst.subLabel && <div className="burst-sub-pop">{burst.subLabel}</div>}
                </div>
              )}
              {burst.particles.map((p, idx) => {
                const tx = Math.cos(p.angle) * p.distance;
                const ty = Math.sin(p.angle) * p.distance;
                return (
                  <span
                    key={idx}
                    className="pixel-particle"
                    style={
                      {
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: p.color,
                        '--tx': `${tx}px`,
                        '--ty': `${ty}px`,
                      } as React.CSSProperties
                    }
                  />
                );
              })}
            </div>
          ))}

          {/* START SCREEN OVERLAY */}
          {!raidStarted && (
            <div className="arena-overlay" data-hud-interactive="true">
              <div className="mission-modal">
                <div className="mission-brand-header">
                  <PixelBrandLogo size={44} />
                  <div>
                    <div className="mission-eyebrow">TAB RAID // MONSTER INVASION</div>
                    <h2 className="mission-heading">YOUR TABS HAVE MUTATED.</h2>
                  </div>
                </div>
                <p className="mission-subhead">
                  HUNT THEM. EARN CREDITS. UPGRADE YOUR BLASTER. CLEAR THE CHAOS.
                </p>

                {/* 5 ARCHETYPE LEGEND */}
                <div className="archetype-roster">
                  {([1, 2, 3, 4, 5] as const).map((tier) => {
                    const spec = MONSTER_ARCHETYPES[tier];
                    return (
                      <div key={spec.id} className="roster-card">
                        <PixelMonsterSprite
                          tier={tier}
                          seedId={tier}
                          frame={spriteFrame}
                          isHitFlashing={false}
                          isLocked={false}
                        />
                        <div className="roster-name">{spec.name}</div>
                        <div className="roster-stats">
                          {spec.maxHp} HP // +{spec.points} CR
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mission-instructions">
                  <div className="instruction-card">
                    <span className="step-num">01 // AIM</span>
                    <p>Point your index finger at the webcam (or aim with mouse).</p>
                  </div>
                  <div className="instruction-card">
                    <span className="step-num">02 // FIRE</span>
                    <p>Raise thumb to cock, fold thumb to fire (or Click / Space).</p>
                  </div>
                  <div className="instruction-card">
                    <span className="step-num">03 // ARMORY</span>
                    <p>
                      Spend credits in the <strong>ARMORY</strong> for 2-HP &amp; 3-HP weapons. Final
                      blow archives &amp; closes the tab in <strong>LIVE MODE</strong>.
                    </p>
                  </div>
                </div>

                <div className="mission-cta-row">
                  <button
                    type="button"
                    className="btn-primary-lime"
                    data-testid="start-raid-btn"
                    onClick={() => {
                      setRaidStarted(true);
                      soundFX.playStartJingle();
                    }}
                  >
                    START RAID ({activeCardsCount} MONSTERS)
                  </button>

                  <button
                    type="button"
                    className="btn-secondary-cam"
                    data-testid="modal-enable-camera-btn"
                    onClick={cameraStatus === 'active' ? disableCamera : enableCamera}
                  >
                    {cameraStatus === 'active' ? 'CAMERA ACTIVE (DISABLE)' : 'ENABLE CAMERA'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VICTORY OVERLAY */}
          {raidStarted && activeCardsCount === 0 && (
            <div className="arena-overlay" data-hud-interactive="true">
              <div className="mission-modal victory-modal" data-testid="desktop-cleared-modal">
                <div className="mission-eyebrow">SECTOR CLEARED // 0 MONSTERS REMAINING</div>
                <h2 className="mission-heading victory-heading">DESKTOP CLEARED.</h2>
                <p className="mission-subhead">ALL MONSTERS ELIMINATED.</p>

                <div className="victory-stats-grid">
                  <div className="v-stat">
                    <span className="v-label">FINAL SCORE</span>
                    <span className="v-val metric-lime">{score}</span>
                  </div>
                  <div className="v-stat">
                    <span className="v-label">CREDITS BANKED</span>
                    <span className="v-val metric-amber">{credits} CR</span>
                  </div>
                  <div className="v-stat">
                    <span className="v-label">ARCHIVED TABS</span>
                    <span className="v-val metric-cyan">{archivedCount}</span>
                  </div>
                </div>

                <div className="mission-cta-row">
                  <button
                    type="button"
                    className="btn-primary-lime"
                    onClick={handleRefreshTargets}
                    data-testid="reload-targets-btn"
                  >
                    RESCAN TABS
                  </button>

                  {closedHistory.length > 0 && (
                    <button type="button" className="btn-secondary-cam" onClick={handleUndo}>
                      UNDO LAST TAB
                    </button>
                  )}

                  {isChromeExtensionEnv() && (
                    <button
                      type="button"
                      className="btn-secondary-cam"
                      onClick={async () => {
                        await spawnDemoRealTabs();
                        setTimeout(handleRefreshTargets, 450);
                      }}
                    >
                      SPAWN 4 TEST TABS
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ZERO-LAG DIRECT-DOM PIXEL CROSSHAIR */}
          <div
            ref={crosshairDomRef}
            className={`arcade-crosshair ${lockedCard ? 'crosshair-locked' : ''} ${
              gestureState.thumbCocked ? 'crosshair-cocked' : ''
            } ${crosshairRecoil ? 'crosshair-recoil' : ''}`}
            style={{
              transform: `translate3d(${crosshairRef.current.x}px, ${crosshairRef.current.y}px, 0)`,
              '--weapon-color': equippedWeapon.laserColor,
            } as React.CSSProperties}
            aria-hidden="true"
          >
            <div className="crosshair-inner">
              <div className="crosshair-ring" />
              <div className="crosshair-dot" />
              <div className="crosshair-line ch-top" />
              <div className="crosshair-line ch-right" />
              <div className="crosshair-line ch-bottom" />
              <div className="crosshair-line ch-left" />
              <div className="crosshair-tag">
                {lockedCard
                  ? `LOCK // ${lockedCard.hp}HP (-${equippedWeapon.damage})`
                  : `${equippedWeapon.name.toUpperCase()} [${equippedWeapon.damage}DMG]`}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT PANEL (30%): LARGE LIVE CAMERA, TELEMETRY & WEAPON LOADOUT */}
        <aside
          className={`camera-panel ${camExpanded ? 'camera-panel-expanded' : ''}`}
          data-hud-interactive="true"
          aria-label="Live Hand Tracking Camera Panel"
        >
          <div className="cam-panel-header">
            <div>
              <div className="cam-panel-title">OPTICAL TRACKING DECK</div>
              <div className="cam-panel-subtitle">1-HAND DIRECT-DOM PIPELINE</div>
            </div>
            <div className="cam-header-btns">
              <button
                type="button"
                className="hud-btn cam-expand-btn"
                onClick={() => setShowPerfOverlay((prev) => !prev)}
                data-testid="perf-toggle-btn"
                title="Toggle tracking FPS & inference telemetry overlay"
              >
                {showPerfOverlay ? 'FPS: ON' : 'FPS: OFF'}
              </button>
              <button
                type="button"
                className="hud-btn cam-expand-btn"
                onClick={() => setCamExpanded((prev) => !prev)}
                title="Toggle expanded camera view"
              >
                {camExpanded ? 'STD' : 'EXPAND'}
              </button>
            </div>
          </div>

          {/* LARGE 4:3 MIRRORED WEBCAM PREVIEW (360x270 at 1366x768) */}
          <div className="cam-viewport-frame" data-testid="camera-viewport">
            <video
              ref={videoRef}
              className="cam-video"
              playsInline
              muted
              width={480}
              height={360}
            />
            <canvas
              ref={landmarkCanvasRef}
              className="cam-canvas"
              width={480}
              height={360}
            />

            {/* LIVE ACTIONABLE GESTURE STATE OVERLAY */}
            <div className="cam-hud-overlay">
              <span
                className={`gesture-state-badge ${
                  gestureState.statusLabel === 'FIRED'
                    ? 'state-fired'
                    : gestureState.statusLabel === 'READY'
                    ? 'state-ready'
                    : gestureState.statusLabel === 'POSE NOT RECOGNIZED'
                    ? 'state-aiming'
                    : 'state-nohand'
                }`}
                data-testid="gesture-status"
              >
                {gestureState.statusLabel}
              </span>
              <span className="input-source-badge">
                AIM: {controlSource.toUpperCase()}
              </span>
            </div>

            {/* MEASURED PERFORMANCE TELEMETRY OVERLAY */}
            {showPerfOverlay && (
              <div className="cam-perf-overlay" data-testid="perf-overlay">
                <span>CAM: {perfMetrics.cameraFps} FPS</span>
                <span>TRACK: {perfMetrics.trackingFps} FPS</span>
                <span>INFER: {perfMetrics.inferenceMs.toFixed(1)} ms ({perfMetrics.delegate})</span>
              </div>
            )}

            {cameraStatus !== 'active' && (
              <div className="cam-placeholder">
                <div className="cam-placeholder-icon">[ CAM // 4:3 ]</div>
                <div className="cam-placeholder-text">
                  {cameraStatus === 'denied'
                    ? 'CAMERA PERMISSION DENIED'
                    : cameraStatus === 'error'
                    ? 'CAMERA FEED UNAVAILABLE'
                    : cameraStatus === 'loading-model'
                    ? 'LOADING MEDIAPIPE WASM...'
                    : cameraStatus === 'requesting'
                    ? 'AWAITING PERMISSION...'
                    : 'CAMERA STANDBY'}
                </div>
                {cameraError && <div className="cam-error-note">{cameraError}</div>}
              </div>
            )}
          </div>

          <div className="gesture-action-hint" data-testid="gesture-detail-hint">
            {gestureState.detailHint}
          </div>

          {/* CAMERA ENABLE / DISABLE CONTROLS */}
          <div className="cam-control-bar">
            {cameraStatus === 'active' ? (
              <button
                type="button"
                className="hud-btn hud-btn-danger-outline full-width-btn"
                onClick={disableCamera}
                data-testid="disable-camera-btn"
              >
                DISABLE CAMERA
              </button>
            ) : (
              <button
                type="button"
                className="hud-btn hud-btn-lime full-width-btn"
                onClick={enableCamera}
                data-testid="enable-camera-btn"
                disabled={cameraStatus === 'requesting' || cameraStatus === 'loading-model'}
              >
                {cameraStatus === 'denied' || cameraStatus === 'error'
                  ? 'RETRY ENABLE CAMERA'
                  : cameraStatus === 'loading-model'
                  ? 'INITIALIZING...'
                  : 'ENABLE CAMERA'}
              </button>
            )}
          </div>

          {/* EQUIPPED WEAPON & QUICK ARMORY ACCESS */}
          <div className="equipped-loadout-box">
            <div className="loadout-row">
              <div>
                <div className="loadout-label">EQUIPPED WEAPON</div>
                <div
                  className="loadout-name"
                  style={{ color: equippedWeapon.laserColor }}
                  data-testid="equipped-weapon-name"
                >
                  {equippedWeapon.name} ({equippedWeapon.damage} DMG)
                </div>
              </div>
              <PixelWeaponSprite weaponId={equippedWeaponId} size={46} />
            </div>
            <button
              type="button"
              className="hud-btn full-width-btn"
              onClick={() => setArmoryOpen((prev) => !prev)}
            >
              {armoryOpen ? 'CLOSE ARMORY' : `OPEN ARMORY (${credits} CR)`}
            </button>
          </div>

          {/* COMPACT CONTROLS & THREAT TABLE INFO POPOVER */}
          <div className="gesture-guide-box">
            <div className="guide-row">
              <span className="guide-key">INDEX FINGER</span>
              <span className="guide-val lime-text">AIM CROSSHAIR</span>
            </div>
            <div className="guide-row">
              <span className="guide-key">THUMB UP / FOLD</span>
              <span className="guide-val">COCK / FIRE SHOT</span>
            </div>
            <div className="guide-row">
              <span className="guide-key">MOUSE + [SPACE]</span>
              <span className="guide-val">INSTANT FALLBACK</span>
            </div>
            <div className="guide-row">
              <span className="guide-key">EST. THREAT TIERS</span>
              <button
                type="button"
                className="hud-btn info-pop-btn"
                onClick={() => setThreatInfoOpen((prev) => !prev)}
                data-testid="threat-info-btn"
              >
                {threatInfoOpen ? 'HIDE INFO' : 'INFO [?]'}
              </button>
            </div>

            {threatInfoOpen && (
              <div className="threat-popover" data-testid="threat-popover">
                <div className="legend-title">EST. THREAT (HEURISTIC) // HP &amp; CREDITS</div>
                {([1, 2, 3, 4, 5] as const).map((t) => {
                  const spec = MONSTER_ARCHETYPES[t];
                  return (
                    <div key={spec.id} className="legend-item">
                      <span className="legend-tier">T{t}</span>
                      <span className="legend-name">{spec.name}</span>
                      <span className="legend-hp">{spec.maxHp}HP</span>
                      <span className="legend-pts">+{spec.points}CR</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
