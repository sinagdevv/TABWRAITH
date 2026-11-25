import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  RaidTab,
  ClosedTabRecord,
  queryRaidTargets,
  archiveAndCloseTab,
  restoreClosedTab,
  spawnDemoRealTabs,
  isChromeExtensionEnv,
  archiveAndCloseMany,
  subscribeTabChanges,
  setNativeGroupCollapsed,
  RaidGroup,
} from '../tabManager/tabManager';
import {
  VaultSession,
  listVault,
  saveGroupSession,
  deleteSession,
  restoreSession,
} from '../tabManager/tabVault';
import { LegionsPanel, LegionInfo, LegionCrest, legionColor } from './Legions';
import {
  FloatingTargetCard,
  LaserBeamEffect,
  ParticleBurst,
  createFloatingCards,
  mergeCards,
  stepFloatingCards,
  findTargetAtPoint,
  createParticleBurst,
} from '../gameEngine/gameEngine';
import { Battlefield } from './Battlefield';
import { RelicSelector, FaceStatus } from './RelicSelector';
import { FaceRelicController, FaceStats } from '../handTracking/faceRelics';
import { RelicId, RELIC_BY_ID } from '../handTracking/relics';
import { CombatMode, COMBAT_MODES, CombatSelector } from './CombatModes';
import { BurstDetector, SwordDetector } from '../gestureEngine/combatGestures';
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

const HIT_PAD_PX = 14; // forgiving pad around a rendered sprite
const HIT_NEAR_PX = 42; // nearest-sprite fallback radius for webcam aiming
const DEBUG_HITBOX = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

const READY_LABELS = new Set<string>(['READY', 'SPELL ARMED', 'SWORD READY']);

const beamTtl = (l: LaserBeamEffect) => (l.style === 'snap' || l.style === 'blade' ? 380 : 210);

const CORNER_GRID = ['GGGGGGG', 'GBBBBBB', 'GBGGGGB', 'GBGTTGB', 'GBGTGGB', 'GBGGGBM', 'GBBBBMM'];
const CORNER_FILL: Record<string, string> = { G: '#CA955C', B: '#6B4A28', M: '#15101c', T: 'var(--mirror-gem)' };

const MirrorCorner: React.FC<{ className: string }> = React.memo(({ className }) => (
  <svg className={`mirror-corner ${className}`} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true">
    {CORNER_GRID.flatMap((row, y) =>
      [...row].map((ch, x) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={CORNER_FILL[ch]} className={ch === 'T' ? 'mirror-gem' : undefined} />
      ))
    )}
  </svg>
));

interface ShotOpts {
  style?: 'bolt' | 'snap' | 'blade';
  tabId?: number;
  pathFrom?: { x: number; y: number };
  pathTo?: { x: number; y: number };
}

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
    'SAFE MODE ACTIVE — DEFEATS ARE SIMULATED UNTIL LIVE MODE IS ARMED'
  );
  const [muted, setMuted] = useState<boolean>(false);
  const [spriteFrame, setSpriteFrame] = useState<0 | 1>(0);
  const [screenShake, setScreenShake] = useState<'none' | 'light' | 'boss'>('none');
  const [crosshairRecoil, setCrosshairRecoil] = useState<boolean>(false);
  const [camExpanded, setCamExpanded] = useState<boolean>(false);

  // Cursed Legions (native tab groups) & Soul Archive
  const [groups, setGroups] = useState<RaidGroup[]>([]);
  const groupsRef = useRef<RaidGroup[]>([]);
  groupsRef.current = groups;
  const collapsedRef = useRef<Set<number>>(new Set()); // arena-side collapse, session-scoped group ids
  const [legionsOpen, setLegionsOpen] = useState<boolean>(false);
  const [sessions, setSessions] = useState<VaultSession[]>([]);
  const [legionBusy, setLegionBusy] = useState<boolean>(false);
  const legionBusyRef = useRef<boolean>(false);

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
  // development only: open index.html?debug to see sprite boxes, hit pads, crosshair and lock
  const [debugRects, setDebugRects] = useState<Array<{ id: number; sx: number; sy: number; sw: number; sh: number; ex: number; ey: number; ew: number; eh: number }>>([]);
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
    (aimStageX: number, aimStageY: number, source: 'hand' | 'mouse' | 'keyboard', opts?: ShotOpts) => void
  >(() => {});

  // Hero Relics (cosmetic face overlay on the shared webcam stream)
  const [relic, setRelic] = useState<RelicId | 'off'>(() => {
    try {
      const v = localStorage.getItem('tabRaidRelic');
      return v && v in RELIC_BY_ID ? (v as RelicId) : 'off';
    } catch {
      return 'off';
    }
  });
  const [faceSeen, setFaceSeen] = useState<boolean>(false);
  const [faceStats, setFaceStats] = useState<FaceStats | null>(null);
  const faceCtlRef = useRef<FaceRelicController>(new FaceRelicController());
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectRelic = useCallback((v: RelicId | 'off') => {
    setRelic(v);
    try {
      localStorage.setItem('tabRaidRelic', v);
    } catch {
      // preference simply isn't remembered
    }
    if (v !== 'off') soundFX.playMaskSelect(RELIC_BY_ID[v].notes);
    else soundFX.playCombatSwitch();
  }, []);

  // Combat style: only the selected style receives gesture input
  const [combatMode, setCombatMode] = useState<CombatMode>('hexcaster');
  const combatModeRef = useRef<CombatMode>('hexcaster');
  const burstRef = useRef(new BurstDetector());
  const swordRef = useRef(new SwordDetector());
  const firedUntilRef = useRef(0);

  const selectCombatMode = useCallback((m: CombatMode) => {
    if (m === combatModeRef.current) return;
    combatModeRef.current = m;
    setCombatMode(m);
    gestureEngineRef.current.reset();
    burstRef.current.reset();
    swordRef.current.reset();
    wasCockedAudioRef.current = false;
    firedUntilRef.current = 0;
    soundFX.playCombatSwitch();
    setStatusBanner(`${COMBAT_MODES.find((c) => c.id === m)!.name} READY`);
  }, []);

  const getStageSize = () => {
    const el = stageRef.current;
    if (!el) return { w: 950, h: 640 };
    return { w: el.clientWidth || 950, h: el.clientHeight || 640 };
  };

  // Hit testing uses the monsters' ACTUAL rendered sprite boxes (same coordinate space as the crosshair),
  // so what you see under the crosshair is what takes the damage:
  //   1. a sprite under (or within a small forgiving pad of) the aim point, nearest sprite centre first
  //   2. otherwise a monster whose plate/label box contains the point
  //   3. otherwise the nearest sprite within a webcam-friendly radius
  const cardElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const hitTest = useCallback((x: number, y: number): FloatingTargetCard | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const sr = stage.getBoundingClientRect();
    const px = sr.left + x;
    const py = sr.top + y;
    let sprite: FloatingTargetCard | null = null;
    let spriteD = Infinity;
    let label: FloatingTargetCard | null = null;
    let labelD = Infinity;
    let near: FloatingTargetCard | null = null;
    let nearEdge = Infinity;
    for (const c of cardsRef.current) {
      if (c.isDestroying || c.hidden) continue;
      const el = cardElsRef.current.get(c.tab.id);
      const spr = el?.querySelector('.monster-sprite-stage svg');
      if (!el || !spr) continue;
      const r = spr.getBoundingClientRect();
      const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
      const edge = Math.hypot(Math.max(r.left - px, 0, px - r.right), Math.max(r.top - py, 0, py - r.bottom));
      if (edge <= HIT_PAD_PX) {
        if (d < spriteD) {
          spriteD = d;
          sprite = c;
        }
        continue;
      }
      const er = el.getBoundingClientRect();
      if (px >= er.left && px <= er.right && py >= er.top && py <= er.bottom && d < labelD) {
        labelD = d;
        label = c;
      }
      if (edge <= HIT_NEAR_PX && edge < nearEdge) {
        nearEdge = edge;
        near = c;
      }
    }
    return sprite ?? label ?? near;
  }, []);

  // Lock history: the HUD shows which monster is locked; attacks use the lock from just before the
  // trigger motion (thumb fold / palm open perturbs the fingertip), so a visible lock means damage.
  const lockLogRef = useRef<Array<{ t: number; id: number | null }>>([]);
  const noteLock = (id: number | null) => {
    const log = lockLogRef.current;
    log.push({ t: performance.now(), id });
    if (log.length > 60) log.shift();
  };
  const lockAt = (t: number): number | null => {
    let id: number | null = null;
    for (const e of lockLogRef.current) if (e.t <= t) id = e.id;
    return id;
  };
  const liveTarget = (id: number | null) => (id === null ? null : cardsRef.current.find((c) => c.tab.id === id && !c.isDestroying && !c.hidden) ?? null);
  /** Target for a gesture attack: the lock ~140ms ago, else the lock right now. */
  const resolveGestureTarget = (): number | null => {
    const now = performance.now();
    const before = liveTarget(lockAt(now - 140));
    const current = liveTarget(lockedTabIdRef.current);
    return (before ?? current)?.tab.id ?? null;
  };

  // development diagnostics (?debug): one record per attack, never per frame
  const attackCountRef = useRef(0);
  const [diag, setDiag] = useState<Record<string, string | number>>({});
  const diagRef = useRef<Record<string, string | number>>({});
  const recordAttack = (rec: Record<string, string | number>) => {
    diagRef.current = { ...diagRef.current, ...rec };
    if (DEBUG_HITBOX) console.info('[TW attack]', rec);
  };

  // Direct DOM crosshair transform update — zero React re-render latency
  const updateCrosshairPosition = useCallback((stageX: number, stageY: number) => {
    crosshairRef.current = { x: stageX, y: stageY };
    if (crosshairDomRef.current) {
      crosshairDomRef.current.style.transform = `translate3d(${stageX}px, ${stageY}px, 0)`;
    }

    const hit = hitTest(stageX, stageY);
    const nextLockedId = hit ? hit.tab.id : null;
    if (nextLockedId !== lockedTabIdRef.current) {
      lockedTabIdRef.current = nextLockedId;
      noteLock(nextLockedId);
      setLockedTabId(nextLockedId);
    }
  }, [hitTest]);

  // Load real or fallback tabs
  const loadTabs = useCallback(async () => {
    const { tabs, groups: g, usingRealTabs: isReal } = await queryRaidTargets();
    defeatedIdsSetRef.current.clear();
    setUsingRealTabs(isReal);
    setGroups(g);
    groupsRef.current = g;
    setCards(mergeCards([], tabs, g, collapsedRef.current));
  }, []);

  // Keep the arena in sync with tabs/groups changed in the browser while the game runs
  const syncTabs = useCallback(async () => {
    if (!isChromeExtensionEnv()) return;
    const q = await queryRaidTargets();
    if (!q.usingRealTabs) return; // never swap real monsters for simulated ones mid-game
    setUsingRealTabs(true);
    setGroups(q.groups);
    groupsRef.current = q.groups;
    setCards((prev) => mergeCards(prev, q.tabs, q.groups, collapsedRef.current));
  }, []);
  const syncTabsRef = useRef(syncTabs);
  syncTabsRef.current = syncTabs;
  useEffect(() => subscribeTabChanges(() => syncTabsRef.current()), []);

  const toggleSquad = useCallback((groupId: number) => {
    const set = collapsedRef.current;
    if (set.has(groupId)) set.delete(groupId);
    else set.add(groupId);
    setCards((prev) => prev.map((c) => (!c.squad && c.tab.groupId === groupId ? { ...c, hidden: set.has(groupId) } : c)));
  }, []);

  // A legion boss only lives while at least one member does
  const pruneLegions = (cs: FloatingTargetCard[]) =>
    cs.filter((c) => !c.squad || cs.some((m) => !m.squad && !m.isDestroying && m.tab.groupId === c.squad!.groupId));

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
    setStatusBanner('RESCANNED BROWSER TABS · WRAITHS SUMMONED');
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
      setStatusBanner(`THE BLACKSMITH TURNS YOU AWAY: NOT ENOUGH CREDITS FOR ${spec.name.toUpperCase()} (NEED ${spec.cost} CR)`);
      return;
    }

    setCredits((prev) => Math.max(0, prev - spec.cost));
    setUnlockedWeapons((prev) => [...prev, weaponId]);
    setEquippedWeaponId(weaponId);
    soundFX.playWeaponUpgrade();
    setStatusBanner(
      `FORGED & EQUIPPED ${spec.name.toUpperCase()} (-${spec.cost} CR · ${spec.damage} DMG)`
    );
  };

  // Core Shooting Mechanic with Weapon Damage (1 / 2 / 3 HP) & Final-Hit Closure
  const fireShot = useCallback(
    async (aimStageX: number, aimStageY: number, source: 'hand' | 'mouse' | 'keyboard', opts?: ShotOpts) => {
      const style = opts?.style ?? 'bolt';
      const beamFrom = opts?.pathFrom ?? { x: 0, y: 0 };
      const { w: stageW, h: stageH } = getStageSize();
      const originX = stageW * 0.5;
      const originY = stageH - 12;

      const weapon = WEAPON_BY_ID[equippedWeaponRef.current];

      setCrosshairRecoil(true);
      setTimeout(() => setCrosshairRecoil(false), 110);

      const hitCard =
        opts?.tabId !== undefined
          ? cardsRef.current.find((c) => c.tab.id === opts.tabId && !c.isDestroying) ?? null
          : hitTest(aimStageX, aimStageY);
      if (!opts?.pathFrom) {
        beamFrom.x = originX;
        beamFrom.y = originY;
      }
      const bladeEnd = style === 'blade' ? opts?.pathTo : undefined;
      const attackN = ++attackCountRef.current;
      const base = { n: attackN, source, style, aim: `${Math.round(aimStageX)},${Math.round(aimStageY)}`, target: hitCard?.tab.id ?? 'none', hpBefore: hitCard?.hp ?? '-', hpAfter: '-', dmg: weapon.damage };
      const beamId = `beam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (style === 'snap') soundFX.playSnapRelease();
      else if (style === 'blade') soundFX.playSwordSwing();
      else soundFX.playLaser(weapon.level);

      if (!hitCard || defeatedIdsSetRef.current.has(hitCard.tab.id)) {
        recordAttack({ ...base, result: 'REJECTED', reason: hitCard ? 'target already defeated' : 'no monster under crosshair' });
        soundFX.playMiss();
        setCombo(1);
        setBursts((prev) => [
          ...prev.slice(-8),
          { id: `miss-${Date.now()}`, x: aimStageX, y: aimStageY, particles: [], label: 'MISS', createdAt: Date.now() },
        ]);
        setLasers((prev) => [
          ...prev.slice(-6),
          {
            id: beamId,
            fromX: beamFrom.x,
            fromY: beamFrom.y,
            toX: bladeEnd ? bladeEnd.x : aimStageX,
            toY: bladeEnd ? bladeEnd.y : aimStageY,
            style,
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
      recordAttack({ ...base, result: 'ACCEPTED', reason: nextHp === 0 ? 'final blow' : 'damage', hpAfter: nextHp });
      const isBoss = hitCard.archetype.tier === 5;

      setLasers((prev) => [
        ...prev.slice(-6),
        {
          id: beamId,
          fromX: beamFrom.x,
          fromY: beamFrom.y,
          toX: bladeEnd ? bladeEnd.x : targetCenterX,
          toY: bladeEnd ? bladeEnd.y : targetCenterY,
          style,
          hit: true,
          color: weapon.laserColor,
          coreColor: weapon.coreColor,
          width: weapon.beamWidth,
          createdAt: Date.now(),
        },
      ]);

      // Legion bosses are visual only: a shot toggles expand/collapse, never damages or closes a tab
      if (hitCard.squad) {
        recordAttack({ ...base, result: 'REJECTED', reason: 'legion boss only toggles' });
        toggleSquad(hitCard.squad.groupId);
        soundFX.playGunReady();
        return;
      }

      // Non-lethal hit: damage flash, recoil, HP reduction, NO tab closure
      if (nextHp > 0) {
        if (style === 'blade') {
          soundFX.playSwordImpact();
        } else if (isBoss || dmg >= 2) {
          soundFX.playBossDamage();
        } else {
          soundFX.playMonsterHit();
        }

        const now = Date.now();
        // update the ref immediately: a second attack in the same frame must see this damage
        cardsRef.current = cardsRef.current.map((c) => (c.tab.id === hitCard.tab.id ? { ...c, hp: nextHp } : c));
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
      if (style !== 'bolt') soundFX.playFinisher();

      const currentCombo = comboRef.current;
      if (currentCombo > 1) {
        soundFX.playCombo(currentCombo);
      }

      cardsRef.current = cardsRef.current.map((c) => (c.tab.id === hitCard.tab.id ? { ...c, hp: 0, isDestroying: true } : c));
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
          `+${scoreEarned} PTS · +${baseCreditsEarned} CR`,
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
        (c) => c.tab.id !== hitCard.tab.id && !c.isDestroying && !c.squad
      ).length;
      if (remainingAfter === 0) {
        setTimeout(() => soundFX.playVictory(), 180);
      }

      setTimeout(() => {
        setCards((prev) => pruneLegions(prev.filter((c) => c.tab.id !== hitCard.tab.id)));
      }, 210);
    },
    [toggleSquad, hitTest]
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

    setCards((prev) =>
      mergeCards(
        prev,
        [...prev.filter((c) => !c.squad && !c.isDestroying).map((c) => c.tab), restoredTab],
        groupsRef.current,
        collapsedRef.current
      )
    );
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
        const { w: sw, h: sh } = getStageSize();
        const next = stepFloatingCards(prev, dt, elapsed, sw, sh);
        cardsRef.current = next;
        return next;
      });

      // Keep lock indicator synced as monsters drift under stationary crosshair
      const { w: stageW, h: stageH } = getStageSize();
      const hit = hitTest(crosshairRef.current.x, crosshairRef.current.y);
      const nextLockedId = hit ? hit.tab.id : null;
      if (nextLockedId !== lockedTabIdRef.current) {
        lockedTabIdRef.current = nextLockedId;
        noteLock(nextLockedId);
        setLockedTabId(nextLockedId);
      }

      if (DEBUG_HITBOX && Math.round(now / 16) % 6 === 0 && stageRef.current) {
        const sr = stageRef.current.getBoundingClientRect();
        const out: typeof debugRects = [];
        cardElsRef.current.forEach((el, id) => {
          const spr = el.querySelector('.monster-sprite-stage svg');
          if (!spr) return;
          const r = spr.getBoundingClientRect();
          const e = el.getBoundingClientRect();
          out.push({ id, sx: r.left - sr.left, sy: r.top - sr.top, sw: r.width, sh: r.height, ex: e.left - sr.left, ey: e.top - sr.top, ew: e.width, eh: e.height });
        });
        setDebugRects(out);
      }

      if (DEBUG_HITBOX && Math.round(now / 16) % 8 === 0) {
        const f = lastFrameRef.current;
        const lockId = lockedTabIdRef.current;
        const lc = lockId === null ? null : cardsRef.current.find((c) => c.tab.id === lockId);
        setDiag({
          ...diagRef.current,
          hand: f?.handDetected ? 'YES' : 'NO',
          gesture: !f || !f.handDetected ? 'IDLE' : f.statusLabel === 'FIRED' ? 'FIRED' : READY_LABELS.has(f.statusLabel) ? 'READY' : 'IDLE',
          cocked: f?.thumbCocked ? 'yes' : 'no',
          attacks: attackCountRef.current,
          crosshair: `${Math.round(crosshairRef.current.x)},${Math.round(crosshairRef.current.y)}`,
          lock: lockId ?? 'none',
          lockHp: lc ? `${lc.hp}/${lc.maxHp}` : '-',
          thumb: f?.thumbClearance !== undefined ? `clr ${f.thumbClearance.toFixed(2)} ext ${(f.thumbExtension ?? 0).toFixed(2)}  cocks ${gestureEngineRef.current.stats.cocks} fires ${gestureEngineRef.current.stats.fires} foldNoCock ${gestureEngineRef.current.stats.foldsWithoutCock} drops ${gestureEngineRef.current.stats.poseDrops}` : '-',
        });
      }

      const wallNow = Date.now();
      setLasers((prev) =>
        prev.some((l) => wallNow - l.createdAt > beamTtl(l))
          ? prev.filter((l) => wallNow - l.createdAt <= beamTtl(l))
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
      detailHint: 'CAMERA STANDBY · MOUSE & [SPACE] ACTIVE',
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

  // One landmark frame -> gesture state, crosshair and attacks. Used by the camera loop (and by the
  // ?debug synthetic-landmark test hook), so tests exercise the real combat path.
  const lastFrameRef = useRef<GestureFrameResult | null>(null);
  const lastStatusRef = useRef<string>('');
  const lastCockedRef = useRef<boolean>(false);
  const handleHandFrame = (
    firstHand: Parameters<GestureEngine['processLandmarks']>[0],
    inferStart: number
  ) => {
    const canvas = landmarkCanvasRef.current;
      const mode = combatModeRef.current;
      let frameResult: GestureFrameResult;

      if (mode === 'hexcaster') {
        frameResult = gestureEngineRef.current.processLandmarks(firstHand, inferStart);
        if (frameResult.isFingerGunPose && frameResult.thumbCocked && !wasCockedAudioRef.current) {
          soundFX.playGunReady();
        }
        wasCockedAudioRef.current = frameResult.isFingerGunPose && frameResult.thumbCocked;
      } else {
        // One shared landmark stream; only the selected style interprets it
        const burst = mode === 'soulsnap' ? burstRef.current.process(firstHand, inferStart) : null;
        const sword = mode === 'wraithblade' ? swordRef.current.process(firstHand, inferStart) : null;
        const aim = burst?.aim ?? sword?.aim ?? null;
        const pose = burst?.pose ?? sword?.pose ?? 'none';
        const fired = Boolean(burst?.cast || sword?.slash);
        if (fired) firedUntilRef.current = inferStart + 220;
        if (burst?.armed && !wasCockedAudioRef.current) soundFX.playSnapArm();
        wasCockedAudioRef.current = Boolean(burst?.armed);
        const swordReady = mode === 'wraithblade' && pose === 'sword';
        frameResult = {
          handDetected: Boolean(aim),
          isFingerGunPose: false,
          thumbCocked: Boolean(burst?.armed),
          thumbFiredThisFrame: fired,
          cooldownProgress: 0,
          crosshairX: aim?.x ?? 0.5,
          crosshairY: aim?.y ?? 0.5,
          statusLabel: !aim
            ? 'NO HAND'
            : inferStart < firedUntilRef.current
            ? 'FIRED'
            : burst?.armed
            ? 'SPELL ARMED'
            : swordReady
            ? 'SWORD READY'
            : mode === 'soulsnap' && pose === 'fist'
            ? 'FIST DETECTED'
            : 'POSE NOT RECOGNIZED',
          detailHint: !aim
            ? 'RAISE HAND IN VIEW OF CAMERA'
            : mode === 'soulsnap'
            ? burst?.armed
              ? 'SPELL ARMED: OPEN YOUR PALM TO CAST'
              : 'MAKE A FIST TO ARM THE SPELL'
            : swordReady
            ? 'HOLD STEADY: THE BLADE FALLS ON YOUR TARGET'
            : 'RAISE INDEX + MIDDLE FINGERS, FOLD THE OTHERS',
          poseConfidence: aim ? 0.8 : 0,
        };

        // Both casts hit whatever the crosshair currently targets (one target, one action)
        if (fired && !raidStartedRef.current) {
          setStatusBanner('PRESS START HUNT TO ATTACK');
          recordAttack({ n: ++attackCountRef.current, source: 'hand', style: burst?.cast ? 'snap' : 'blade', result: 'REJECTED', reason: 'hunt not started' });
        }
        if (raidStartedRef.current && aim) {
          const { w: stageW, h: stageH } = getStageSize();
          if (burst?.cast) {
            fireShotRef.current(burst.cast.x * stageW, burst.cast.y * stageH, 'hand', { style: 'snap', tabId: resolveGestureTarget() ?? undefined });
          } else if (sword?.slash) {
            const sx = sword.slash.x * stageW;
            const sy = sword.slash.y * stageH;
            const target = liveTarget(resolveGestureTarget()) ?? hitTest(sx, sy);
            const cx = target ? (target.x / 100) * stageW : sx;
            const cy = target ? (target.y / 100) * stageH : sy;
            fireShotRef.current(sx, sy, 'hand', {
              style: 'blade',
              tabId: target?.tab.id,
              pathFrom: { x: cx - 95, y: cy - 75 },
              pathTo: { x: cx + 95, y: cy + 75 },
            });
          }
        }
      }

      lastFrameRef.current = frameResult;
      if (canvas) {
        drawHandLandmarks(
          canvas,
          firstHand,
          frameResult.isFingerGunPose || READY_LABELS.has(frameResult.statusLabel),
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

        if (mode === 'hexcaster' && frameResult.thumbFiredThisFrame) {
          if (!raidStartedRef.current) {
            setStatusBanner('PRESS START HUNT TO ATTACK');
            recordAttack({ n: ++attackCountRef.current, source: 'hand', style: 'bolt', result: 'REJECTED', reason: 'hunt not started' });
          } else {
            // __noLatch (debug only) reproduces the old behaviour: shoot at the current, already nudged, crosshair
            const latch = !(DEBUG_HITBOX && (window as unknown as { __noLatch?: boolean }).__noLatch);
            fireShotRef.current(
              (latch ? frameResult.fireAimX ?? frameResult.crosshairX : frameResult.crosshairX) * getStageSize().w,
              (latch ? frameResult.fireAimY ?? frameResult.crosshairY : frameResult.crosshairY) * getStageSize().h,
              'hand',
              { tabId: latch ? resolveGestureTarget() ?? undefined : undefined }
            );
          }
        }
      }

      // Only commit React state when gesture status label or cocked state changes
      if (
        frameResult.statusLabel !== lastStatusRef.current ||
        frameResult.thumbCocked !== lastCockedRef.current ||
        frameResult.thumbFiredThisFrame
      ) {
        if (DEBUG_HITBOX) console.info('[TW gesture]', mode, frameResult.statusLabel, frameResult.thumbCocked ? 'cocked' : 'not cocked', frameResult.thumbFiredThisFrame ? 'FIRE' : '');
        lastStatusRef.current = frameResult.statusLabel;
        lastCockedRef.current = frameResult.thumbCocked;
        setGestureState(frameResult);
      }
  };
  const handleHandFrameRef = useRef(handleHandFrame);
  handleHandFrameRef.current = handleHandFrame;
  useEffect(() => {
    if (DEBUG_HITBOX) {
      (window as unknown as Record<string, unknown>).__tabwraithTest = {
        feed: (lm: Parameters<GestureEngine['processLandmarks']>[0], t: number) => handleHandFrameRef.current(lm, t),
        setRaidStarted: () => setRaidStarted(true),
        grantCredits: (n: number) => setCredits((c) => c + n),
        lastAttack: () => diagRef.current,
        hitMs: (n: number) => {
          const t0 = performance.now();
          for (let i = 0; i < n; i++) hitTest(300 + (i % 50), 300);
          return (performance.now() - t0) / n;
        },
      };
    }
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
      setStatusBanner('CAMERA ONLINE · AIM WITH INDEX FINGER, FOLD THUMB TO SHOOT');

      let lastMediaTime = -1;
      let lastInferenceTimestamp = -1;
      let camFramesCount = 0;
      let trackFramesCount = 0;
      let latestInferMs = 0;
      let lastPerfCommitTime = performance.now();
      lastStatusRef.current = '';
      lastCockedRef.current = false;

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

              handleHandFrameRef.current(detections.landmarks?.[0] ?? null, inferStart);
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

          faceCtlRef.current.report(camFps, trackFps);
          setFaceSeen(faceCtlRef.current.visible);
          setFaceStats(faceCtlRef.current.stats());

          setPerfMetrics({
            cameraFps: camFps,
            trackingFps: trackFps,
            inferenceMs: Math.round(latestInferMs * 10) / 10,
            delegate: getActiveDelegate(),
            gestureState: lastStatusRef.current || 'NO HAND',
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

  useEffect(() => {
    const ctl = faceCtlRef.current;
    ctl.onAutoDisable = () => {
      setRelic('off');
      setStatusBanner('RELIC TRACKING PAUSED TO KEEP HAND TRACKING FAST');
    };
    if (cameraStatus === 'active' && relic !== 'off' && videoRef.current && maskCanvasRef.current) {
      ctl.start(videoRef.current, maskCanvasRef.current, relic);
    } else {
      ctl.stop();
      setFaceSeen(false);
      setFaceStats(null);
    }
  }, [cameraStatus, relic]);
  useEffect(() => () => faceCtlRef.current.stop(), []);

  // Spacebar fallback shooting
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        selectCombatMode((['hexcaster', 'soulsnap', 'wraithblade'] as const)[+e.code.slice(5) - 1]);
        return;
      }
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
  }, [selectCombatMode]);

  // Stage mouse aiming & click fallback (direct DOM crosshair update)
  const handleStageMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (e.movementX === 0 && e.movementY === 0) return; // synthetic move from animated monsters under a still cursor
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

  const memberTabs = (groupId: number): RaidTab[] =>
    cards
      .filter((c) => !c.squad && !c.isDestroying && c.tab.groupId === groupId)
      .map((c) => c.tab)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const legions: LegionInfo[] = groups
    .map((g) => ({ group: g, members: memberTabs(g.id), collapsedInArena: collapsedRef.current.has(g.id) }))
    .filter((l) => l.members.length > 0);
  const ungroupedCount = cards.filter((c) => !c.squad && !c.isDestroying && c.tab.groupId === undefined).length;

  const openLegions = async () => {
    setArmoryOpen(false);
    setThreatInfoOpen(false);
    setLegionsOpen((o) => !o);
    setSessions(await listVault());
  };

  const saveLegion = async (l: LegionInfo) => {
    const res = await saveGroupSession(l.group, l.members);
    setSessions(await listVault());
    setStatusBanner(res.success ? `SAVED "${l.group.title}" TO THE SOUL ARCHIVE (${l.members.length} TABS)` : `SAVE FAILED: ${res.error}`);
  };

  const restoreLegion = async (session: VaultSession) => {
    if (legionBusyRef.current) return;
    legionBusyRef.current = true;
    setLegionBusy(true);
    try {
      const res = await restoreSession(session, liveModeRef.current);
      if (!liveModeRef.current) {
        setStatusBanner('SAFE MODE: RESTORE SIMULATED. ARM LIVE MODE TO REOPEN TABS');
      } else {
        setStatusBanner(
          res.success
            ? `RESTORED ${res.count} TABS${res.grouped ? ' AS A NATIVE GROUP' : ' (GROUP COULD NOT BE RECREATED)'}${res.error ? ` · ${res.error}` : ''}`
            : `RESTORE FAILED: ${res.error}`
        );
        window.setTimeout(() => syncTabsRef.current(), 600);
      }
    } finally {
      legionBusyRef.current = false;
      setLegionBusy(false);
    }
  };

  const toggleNativeGroup = async (l: LegionInfo) => {
    const ok = await setNativeGroupCollapsed(l.group.id, !l.group.collapsed);
    if (ok) syncTabsRef.current();
    else setStatusBanner('COULD NOT FOLD THE NATIVE GROUP');
  };

  // Group cleanup: LIVE MODE only, snapshot first, bookmark everything first, single request per tab
  const cleanupLegion = async (l: LegionInfo) => {
    if (!liveModeRef.current) {
      setStatusBanner('SAFE MODE: CLEANUP BLOCKED. ARM LIVE MODE FIRST');
      return;
    }
    if (legionBusyRef.current) return;
    const tabs = l.members.filter((t) => !t.isMock && !defeatedIdsSetRef.current.has(t.id));
    if (tabs.length === 0) {
      setStatusBanner('NOTHING ELIGIBLE TO CLOSE (SIMULATED TABS ARE NEVER CLOSED)');
      return;
    }
    legionBusyRef.current = true;
    setLegionBusy(true);
    const ids = new Set(tabs.map((t) => t.id));
    try {
      const saved = await saveGroupSession(l.group, tabs);
      if (!saved.success) {
        setStatusBanner(`CLEANUP ABORTED: ARCHIVE FAILED (${saved.error})`);
        return;
      }
      setSessions(await listVault());
      ids.forEach((id) => defeatedIdsSetRef.current.add(id));
      setCards((prev) => prev.map((c) => (ids.has(c.tab.id) ? { ...c, isDestroying: true } : c)));
      const res = await archiveAndCloseMany(tabs, true);
      if (!res.success) {
        ids.forEach((id) => defeatedIdsSetRef.current.delete(id));
        setCards((prev) => prev.map((c) => (ids.has(c.tab.id) ? { ...c, isDestroying: false } : c)));
        setStatusBanner(`CLEANUP ABORTED, NO TABS CLOSED: ${res.error}`);
        return;
      }
      soundFX.playRestore();
      setClosedHistory((prev) => [...res.records, ...prev]);
      setArchivedCount((n) => n + res.records.length);
      setStatusBanner(`"${l.group.title}" ARCHIVED & CLOSED (${res.records.length} TABS). UNDO RESTORES ONE AT A TIME`);
      window.setTimeout(() => setCards((prev) => pruneLegions(prev.filter((c) => !ids.has(c.tab.id)))), 210);
    } finally {
      legionBusyRef.current = false;
      setLegionBusy(false);
    }
  };

  const equippedWeapon = WEAPON_BY_ID[equippedWeaponId];
  const maxMonstersRef = useRef(0);
  maxMonstersRef.current = Math.max(maxMonstersRef.current, cards.filter((c) => !c.isDestroying && !c.squad).length);
  const maxMonsters = maxMonstersRef.current;
  const mirrorState =
    cameraStatus === 'denied' || cameraStatus === 'error'
      ? 'mirror-error'
      : cameraStatus !== 'active'
      ? 'mirror-off'
      : gestureState.statusLabel === 'FIRED'
      ? 'mirror-fired'
      : READY_LABELS.has(gestureState.statusLabel)
      ? 'mirror-ready'
      : gestureState.handDetected
      ? 'mirror-tracking'
      : 'mirror-idle';
  const lockedCard = cards.find((c) => !c.isDestroying && c.tab.id === lockedTabId) || null;
  const activeCardsCount = cards.filter((c) => !c.isDestroying && !c.squad).length;
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
          <PixelBrandLogo size={38} />
          <div className="hud-wordmark">
            <h1 className="hud-title">TABWRAITH</h1>
            <span className="hud-title-sub">CURSE OF THE OPEN TABS</span>
          </div>
        </div>

        <span className="hud-divider" aria-hidden="true" />

        <div className="hud-stats" role="region" aria-label="Hunt Status">
          <div className="hud-stat hud-stat-hp" title="Cursed tabs remaining">
            <span className="metric-label">CURSED TABS</span>
            <div className="hud-hp">
              <div className="hud-hp-bar">
                <span style={{ width: `${Math.round((activeCardsCount / Math.max(1, maxMonsters)) * 100)}%` }} />
              </div>
              <span className="metric-value" data-testid="remaining-count">
                {activeCardsCount}
              </span>
            </div>
          </div>
          <div className="hud-stat">
            <span className="metric-label">SCORE</span>
            <span className="metric-value metric-lime" data-testid="score-value">
              {score.toString().padStart(6, '0')}
            </span>
          </div>
          <div className="hud-stat">
            <span className="metric-label">CREDITS</span>
            <span className="metric-value metric-lime" data-testid="credits-value">
              {credits} CR
            </span>
          </div>
          <div className={`hud-combo ${combo > 1 ? 'hud-combo-hot' : ''}`} title="Combo multiplier">
            <span className="metric-value" data-testid="combo-value">
              {combo}x
            </span>
          </div>
          <span className="hud-archived" title="Tabs archived this session">
            ARCHIVED <b data-testid="archived-count">{archivedCount}</b>
          </span>
        </div>

        <div className="hud-actions">
          <button
            type="button"
            className={`hud-btn hud-btn-armory ${armoryOpen ? 'armory-active' : ''}`}
            onClick={() => {
              setArmoryOpen((prev) => !prev);
              setThreatInfoOpen(false);
              setLegionsOpen(false);
            }}
            data-testid="armory-toggle-btn"
            title="Visit The Blacksmith to forge stronger weapons"
          >
            <PixelWeaponSprite weaponId={equippedWeaponId} size={22} />
            <span>BLACKSMITH</span>
          </button>

          <button
            type="button"
            className={`hud-btn ${legionsOpen ? 'armory-active' : ''}`}
            onClick={openLegions}
            data-testid="legions-toggle-btn"
            title="Cursed Legions: tab groups and the Soul Archive"
            aria-expanded={legionsOpen}
          >
            LEGIONS ({legions.length})
          </button>

          <span className="hud-divider" aria-hidden="true" />

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

          <span className="hud-divider" aria-hidden="true" />

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
          aria-label="Cursed Battlefield"
          onMouseMove={handleStageMouseMove}
          onClick={handleStageClick}
        >
          <Battlefield />
          <div className="arena-banner" key={statusBanner} role="status">{statusBanner}</div>

          {legionsOpen && (
            <LegionsPanel
              legions={legions}
              ungroupedCount={ungroupedCount}
              sessions={sessions}
              liveMode={liveMode}
              busy={legionBusy}
              native={isChromeExtensionEnv()}
              onToggleArena={(id) => {
                toggleSquad(id);
              }}
              onToggleNative={toggleNativeGroup}
              onSave={saveLegion}
              onCleanup={cleanupLegion}
              onRestore={restoreLegion}
              onDelete={async (id) => {
                await deleteSession(id);
                setSessions(await listVault());
              }}
              onClose={() => setLegionsOpen(false)}
            />
          )}

          {/* IN-GAME PIXEL ARMORY POPOVER PANEL */}
          {armoryOpen && (
            <div
              className="armory-drawer"
              data-hud-interactive="true"
              data-testid="armory-panel"
            >
              <div className="armory-header">
                <div>
                  <span className="armory-title">THE BLACKSMITH · WEAPON FORGING</span>
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

            if (card.hidden) return null;

            if (card.squad) {
              const sq = card.squad;
              const alive = cards.filter((c) => !c.squad && !c.isDestroying && c.tab.groupId === sq.groupId).length;
              const folded = collapsedRef.current.has(sq.groupId);
              return (
                <div
                  key={card.tab.id}
                  ref={(el) => {
                    if (el) cardElsRef.current.set(card.tab.id, el);
                    else cardElsRef.current.delete(card.tab.id);
                  }}
                  data-testid={`legion-card-${sq.groupId}`}
                  className={`monster-unit legion-unit ${isLocked ? 'monster-locked' : ''}`}
                  style={{
                    left: `${card.x}%`,
                    top: `${card.y}%`,
                    width: `${card.widthPx}px`,
                    transform: `translate(-50%, -50%)`,
                    ['--legion-color' as string]: legionColor(sq.color),
                  }}
                >
                  <div className="legion-plate">
                    <span className="legion-plate-title">{sq.title}</span>
                    <span className="legion-plate-count">{alive} / {sq.total} TABS</span>
                    <div className="legion-health" aria-label="Legion strength">
                      <span style={{ width: `${Math.round((alive / Math.max(1, sq.total)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="monster-sprite-stage">
                    {isLocked && (
                      <div className="target-reticle-brackets">
                        <span className="lock-dmg-callout">{folded ? 'SHOOT TO EXPAND' : 'SHOOT TO COLLAPSE'}</span>
                      </div>
                    )}
                    <LegionCrest color={sq.color} size={96} flash={isHitFlashing} />
                  </div>
                  <button
                    type="button"
                    className="hud-btn legion-toggle"
                    data-hud-interactive="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSquad(sq.groupId);
                    }}
                    aria-expanded={!folded}
                  >
                    {folded ? 'EXPAND LEGION' : 'COLLAPSE LEGION'}
                  </button>
                </div>
              );
            }

            return (
              <div
                key={card.tab.id}
                ref={(el) => {
                  if (el) cardElsRef.current.set(card.tab.id, el);
                  else cardElsRef.current.delete(card.tab.id);
                }}
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

          {DEBUG_HITBOX && (
            <pre className="debug-panel" data-testid="debug-panel">
{`hand ${diag.hand ?? '-'}   gesture ${diag.gesture ?? '-'}   thumb cocked ${diag.cocked ?? '-'}
crosshair ${diag.crosshair ?? '-'}   lock ${diag.lock ?? '-'} (${diag.lockHp ?? '-'})
${diag.thumb ?? ''}
attacks ${diag.attacks ?? 0}  last: ${diag.source ?? '-'} ${diag.style ?? ''} ${diag.result ?? '-'} (${diag.reason ?? '-'})
  aim ${diag.aim ?? '-'} target/tab ${diag.target ?? '-'}  dmg ${diag.dmg ?? '-'}  hp ${diag.hpBefore ?? '-'} -> ${diag.hpAfter ?? '-'}`}
            </pre>
          )}
          {DEBUG_HITBOX && (
            <svg className="arena-vfx-svg debug-hitbox" aria-hidden="true" data-testid="debug-hitbox">
              {debugRects.map((d) => (
                <g key={d.id} className={d.id === lockedTabId ? 'dbg-locked' : ''}>
                  <rect x={d.ex} y={d.ey} width={d.ew} height={d.eh} className="dbg-el" />
                  <rect x={d.sx - HIT_PAD_PX} y={d.sy - HIT_PAD_PX} width={d.sw + HIT_PAD_PX * 2} height={d.sh + HIT_PAD_PX * 2} className="dbg-pad" />
                  <rect x={d.sx} y={d.sy} width={d.sw} height={d.sh} className="dbg-sprite" />
                  <text x={d.sx} y={d.sy - HIT_PAD_PX - 3} className="dbg-text">{d.id}</text>
                </g>
              ))}
              <text x={8} y={16} className="dbg-text">
                crosshair {Math.round(crosshairRef.current.x)},{Math.round(crosshairRef.current.y)} lock {lockedTabId ?? 'none'}
              </text>
            </svg>
          )}

          {/* PIXEL LASER TRAJECTORIES (WEAPON-SCALED COLOR & THICKNESS) */}
          <svg className="arena-vfx-svg" aria-hidden="true">
            {lasers.map((beam) =>
              beam.style === 'snap' ? (
                <g key={beam.id} transform={`translate(${beam.toX} ${beam.toY})`}><g className="fx-snap">
                  <circle r="52" className="fx-snap-ring" />
                  <circle r="30" className="fx-snap-ring fx-snap-inner" />
                  {Array.from({ length: 8 }, (_, i) => {
                    const ang = (i / 8) * Math.PI * 2;
                    return <rect key={i} x={Math.cos(ang) * 52 - 3} y={Math.sin(ang) * 52 - 3} width="6" height="6" className="fx-snap-rune" />;
                  })}
                </g></g>
              ) : beam.style === 'blade' ? (
                <g key={beam.id} className="fx-blade">
                  <path
                    d={`M ${beam.fromX} ${beam.fromY} Q ${(beam.fromX + beam.toX) / 2 - (beam.toY - beam.fromY) * 0.18} ${(beam.fromY + beam.toY) / 2 + (beam.toX - beam.fromX) * 0.18} ${beam.toX} ${beam.toY}`}
                    className="fx-blade-trail"
                  />
                  <path
                    d={`M ${beam.fromX} ${beam.fromY} Q ${(beam.fromX + beam.toX) / 2 - (beam.toY - beam.fromY) * 0.18} ${(beam.fromY + beam.toY) / 2 + (beam.toX - beam.fromX) * 0.18} ${beam.toX} ${beam.toY}`}
                    className="fx-blade-core"
                  />
                </g>
              ) : (
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
              )
            )}
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
              <div className="mission-modal title-screen">
                <PixelBrandLogo size={72} />
                <h2 className="mission-heading">TABWRAITH</h2>
                <div className="mission-eyebrow">CURSE OF THE OPEN TABS</div>
                <p className="mission-subhead">THE TABS YOU FORGOT HAVE RETURNED.</p>

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
                          {spec.maxHp} HP · +{spec.points}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="gesture-strip">
                  <span><b>AIM</b> index finger / mouse</span>
                  <span><b>FIRE</b> fold thumb / click / Space</span>
                  <span><b>LIVE MODE</b> bookmarks, then closes</span>
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
                    START HUNT ({activeCardsCount})
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
                <div className="mission-eyebrow">BATTLEFIELD CLEARED · 0 CURSED TABS REMAIN</div>
                <h2 className="mission-heading victory-heading">THE CURSE IS BROKEN.</h2>
                <p className="mission-subhead">EVERY WRAITH LAID TO REST.</p>

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
                {lockedCard?.squad
                  ? 'LEGION BOSS (NO DAMAGE)'
                  : lockedCard
                  ? `LOCK · ${lockedCard.hp}HP (-${equippedWeapon.damage})`
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
            <div className="cam-panel-title">THE SCRYING MIRROR</div>
            <div className="cam-header-btns">
              <button
                type="button"
                className="hud-btn cam-expand-btn"
                onClick={() => setShowPerfOverlay((prev) => !prev)}
                data-testid="perf-toggle-btn"
                title="Toggle tracking FPS & inference telemetry"
              >
                {showPerfOverlay ? 'FPS: ON' : 'FPS: OFF'}
              </button>
              <button
                type="button"
                className="hud-btn cam-expand-btn"
                onClick={() => setCamExpanded((prev) => !prev)}
                title="Toggle expanded mirror"
              >
                {camExpanded ? 'STD' : 'EXPAND'}
              </button>
            </div>
          </div>

          {/* ENCHANTED FRAME (decorations sit OUTSIDE the video box; pointer-events none) */}
          <div className={`scrying-mirror ${mirrorState} mirror-mode-${combatMode}`} data-testid="camera-viewport">
            <div className="mirror-frame">
              <span className="mirror-rune mr-t" aria-hidden="true">ᚠ</span>
              <span className="mirror-rune mr-r" aria-hidden="true">ᚱ</span>
              <span className="mirror-rune mr-b" aria-hidden="true">ᛉ</span>
              <span className="mirror-rune mr-l" aria-hidden="true">ᛟ</span>
              <div className="cam-viewport-frame">
                <video
                  ref={videoRef}
                  className="cam-video"
                  playsInline
                  muted
                  width={480}
                  height={360}
                />
                <canvas ref={maskCanvasRef} className="cam-canvas cam-mask" width={480} height={360} aria-hidden="true" />
                <canvas
                  ref={landmarkCanvasRef}
                  className="cam-canvas"
                  width={480}
                  height={360}
                />

                {cameraStatus !== 'active' && (
                  <div className="cam-placeholder">
                    <div className="cam-placeholder-icon">[ THE MIRROR SLEEPS ]</div>
                    <div className="cam-placeholder-text">
                      {cameraStatus === 'denied'
                        ? 'CAMERA PERMISSION DENIED — ALLOW IT IN SITE SETTINGS'
                        : cameraStatus === 'error'
                        ? 'CAMERA FEED UNAVAILABLE — MOUSE & SPACE STILL WORK'
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
              <MirrorCorner className="mc-tl" />
              <MirrorCorner className="mc-tr" />
              <MirrorCorner className="mc-bl" />
              <MirrorCorner className="mc-br" />
            </div>
          </div>

          {/* STATUS PLATE (outside the video so the hand is never covered) */}
          <div className="mirror-plate">
            <span
              className={`gesture-state-badge ${
                gestureState.statusLabel === 'FIRED'
                  ? 'state-fired'
                  : READY_LABELS.has(gestureState.statusLabel)
                  ? 'state-ready'
                  : gestureState.statusLabel === 'POSE NOT RECOGNIZED'
                  ? 'state-aiming'
                  : 'state-nohand'
              }`}
              data-testid="gesture-status"
            >
              {gestureState.statusLabel}
            </span>
            <span className="input-source-badge">AIM: {controlSource.toUpperCase()}</span>
          </div>

          <div className="gesture-action-hint" data-testid="gesture-detail-hint">
            {gestureState.detailHint}
          </div>

          <RelicSelector
            value={relic}
            onSelect={selectRelic}
            status={
              relic === 'off' ? 'off' : cameraStatus !== 'active' ? 'camera-off' : faceSeen ? 'tracking' : ('searching' as FaceStatus)
            }
          />

          <CombatSelector mode={combatMode} onSelect={selectCombatMode} />

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
              {armoryOpen ? 'CLOSE BLACKSMITH' : `OPEN BLACKSMITH (${credits} CR)`}
            </button>
          </div>

          {/* COMPACT CONTROLS & THREAT TABLE INFO POPOVER */}
          <details className="mirror-details">
            <summary>TRACKING DETAILS &amp; CONTROLS</summary>
            {showPerfOverlay && (
              <div className="cam-perf-overlay" data-testid="perf-overlay">
                <span>CAM: {perfMetrics.cameraFps} FPS</span>
                <span>TRACK: {perfMetrics.trackingFps} FPS</span>
                <span>INFER: {perfMetrics.inferenceMs.toFixed(1)} ms ({perfMetrics.delegate})</span>
                {faceStats && (
                  <span>
                    RELIC: {faceStats.fps} FPS · {faceStats.ms} ms · every {faceStats.intervalMs} ms
                  </span>
                )}
              </div>
            )}
          <div className="gesture-guide-box">
            {COMBAT_MODES.find((c) => c.id === combatMode)!.guide.map(([k, v]) => (
              <div className="guide-row" key={k}>
                <span className="guide-key">{k}</span>
                <span className="guide-val">{v}</span>
              </div>
            ))}
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
          </details>
        </aside>
      </div>
    </div>
  );
};
