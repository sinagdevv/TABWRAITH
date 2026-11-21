import React, { useEffect, useRef, useState } from 'react';
import {
  BESTIARY_MONSTERS,
  WEAPONS,
  WeaponId,
  ThreatTier,
  PixelMonsterSprite,
  PixelWeaponSprite,
  PixelBrandLogo,
  PixelCorruptedTabIcon,
} from './PixelSprites';
import { siteSoundFX } from './siteSoundFX';

const ZIP_FILENAME = 'tab-raid-v4.0.0-extension.zip';
const ZIP_VERSION = 'v4.0.0 (MV3 Unpacked Build)';
const ZIP_SIZE_DISPLAY = '11.35 MB (11,905,579 bytes)';
const ZIP_SHA256 = '94bd49ae9f874e232d19669f703505d60898b125df17d13d4ec1a2fd4e19ddb9';
const LOCAL_DOWNLOAD_URL = '/downloads/tab-raid-v4.0.0-extension.zip';
const GITHUB_RELEASE_ZIP_URL =
  'https://github.com/sinagdevv/tabRaid/releases/download/v4.0.0/tab-raid-v4.0.0-extension.zip';
const GITHUB_REPO_URL = 'https://github.com/sinagdevv/tabRaid';

interface HeroBurst {
  id: number;
  x: number;
  y: number;
}

const INSTALL_STEPS = [
  {
    num: '01',
    title: 'DOWNLOAD ZIP',
    summary: 'Grab the compiled MV3 extension archive (`tab-raid-v4.0.0-extension.zip`).',
    detail:
      'Contains manifest.json at the archive root alongside compiled assets and offline MediaPipe WASM/model binaries.',
  },
  {
    num: '02',
    title: 'EXTRACT FILES',
    summary: 'Unzip the archive into a permanent folder on your desktop or machine.',
    detail:
      'Keep the extracted folder in place while the unpacked extension is installed in your browser.',
  },
  {
    num: '03',
    title: 'OPEN EXTENSIONS PAGE',
    summary: 'Copy and paste the Extensions URL for Chrome or Brave into your address bar.',
    detail: 'Use the one-click copy button below to copy chrome://extensions or brave://extensions.',
  },
  {
    num: '04',
    title: 'ENABLE DEVELOPER MODE',
    summary: 'Flip the Developer mode toggle switch in the top-right corner of the page.',
    detail:
      'Required because TAB RAID is distributed as an early-access unpacked DevFest build.',
  },
  {
    num: '05',
    title: 'LOAD UNPACKED',
    summary: 'Click "Load unpacked" (top-left) and select your extracted folder.',
    detail:
      'Select the folder that directly contains manifest.json, index.html, and the mediapipe/ directory.',
  },
  {
    num: '06',
    title: 'LAUNCH TAB RAID',
    summary: 'Pin TAB RAID in your toolbar and click the pixel crosshair icon to enter the arena.',
    detail:
      'Grant webcam permission when prompted, form a finger gun, or use Mouse + Spacebar fallback.',
  },
];

export const App: React.FC = () => {
  // Cinematic Intro state (skippable, auto-completes in 2.6s, respects prefers-reduced-motion)
  const [introActive, setIntroActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return true;
  });
  const [introStage, setIntroStage] = useState<number>(1);

  // Global sprite animation frame (paused when document is hidden)
  const [spriteFrame, setSpriteFrame] = useState<0 | 1>(0);
  const [sfxMuted, setSfxMuted] = useState<boolean>(false);

  // Hero Interactive Battlefield state
  const heroStageRef = useRef<HTMLDivElement | null>(null);
  const heroCrosshairRef = useRef<HTMLDivElement | null>(null);
  const [heroDemoHits, setHeroDemoHits] = useState<number>(0);
  const [heroTargetFlash, setHeroTargetFlash] = useState<boolean>(false);
  const [heroBursts, setHeroBursts] = useState<HeroBurst[]>([]);
  const [heroLaserActive, setHeroLaserActive] = useState<boolean>(false);

  // Bestiary hover state
  const [hoveredTier, setHoveredTier] = useState<ThreatTier | null>(null);
  const bestiaryTrackRef = useRef<HTMLDivElement | null>(null);

  // Interactive Armory Showcase state
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>('double-barrel');
  const [weaponFiring, setWeaponFiring] = useState<boolean>(false);
  const [dummyHp, setDummyHp] = useState<number>(5);
  const [dummyFlash, setDummyFlash] = useState<boolean>(false);

  // Interactive Installation Tutorial state
  const [selectedBrowser, setSelectedBrowser] = useState<'chrome' | 'brave'>('brave');
  const [activeInstallStep, setActiveInstallStep] = useState<number>(0);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedSha, setCopiedSha] = useState<boolean>(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // 1. Cinematic Intro sequence timer (2.6s total)
  useEffect(() => {
    if (!introActive) return;
    const t1 = window.setTimeout(() => setIntroStage(2), 400); // Corrupted tab appears
    const t2 = window.setTimeout(() => setIntroStage(3), 900); // Mutates into pixel monster
    const t3 = window.setTimeout(() => setIntroStage(4), 1450); // Lime laser shoots across
    const t4 = window.setTimeout(() => setIntroStage(5), 1850); // Monster explodes into logo
    const t5 = window.setTimeout(() => setIntroActive(false), 2600); // Reveal site

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [introActive]);

  // 2. Idle 2-frame pixel sprite ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setSpriteFrame((prev) => (prev === 0 ? 1 : 0));
    }, 380);
    return () => clearInterval(interval);
  }, []);

  // 3. Scroll-reveal IntersectionObserver
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const elements = document.querySelectorAll('.reveal-on-scroll');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.12 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [introActive]);

  // Hero battlefield mouse tracking (direct DOM transform for 60fps smoothness)
  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const stage = heroStageRef.current;
    const ch = heroCrosshairRef.current;
    if (!stage || !ch) return;
    const rect = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    ch.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  // Special Hero Interaction: Shoot the interactive Glitch Slime target
  const handleShootHeroMonster = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    siteSoundFX.playHeroShot();
    setHeroDemoHits((prev) => prev + 1);
    setHeroTargetFlash(true);
    setHeroLaserActive(true);

    const stage = heroStageRef.current;
    const btnRect = e.currentTarget.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    const bx = stageRect ? btnRect.left - stageRect.left + btnRect.width / 2 : 220;
    const by = stageRect ? btnRect.top - stageRect.top + btnRect.height / 2 : 160;

    const burstId = Date.now() + Math.random();
    setHeroBursts((prev) => [...prev.slice(-4), { id: burstId, x: bx, y: by }]);

    window.setTimeout(() => setHeroTargetFlash(false), 180);
    window.setTimeout(() => setHeroLaserActive(false), 160);
    window.setTimeout(() => {
      setHeroBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 650);
  };

  // Interactive Armory Test Fire
  const handleTestWeaponFire = (weaponId: WeaponId) => {
    const spec = WEAPONS.find((w) => w.id === weaponId) || WEAPONS[0];
    setSelectedWeapon(weaponId);
    setWeaponFiring(true);
    setDummyFlash(true);
    siteSoundFX.playWeaponFire(spec.level);

    setDummyHp((prev) => {
      const next = prev - spec.damage;
      return next <= 0 ? 5 : next;
    });

    window.setTimeout(() => setWeaponFiring(false), 150);
    window.setTimeout(() => setDummyFlash(false), 170);
  };

  const extUrl = selectedBrowser === 'brave' ? 'brave://extensions' : 'chrome://extensions';

  const handleCopyExtUrl = async () => {
    try {
      await navigator.clipboard.writeText(extUrl);
    } catch {
      // Fallback if clipboard API restricted
    }
    siteSoundFX.playCopyConfirm();
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 1800);
  };

  const handleCopySha = async () => {
    try {
      await navigator.clipboard.writeText(ZIP_SHA256);
    } catch {
      // Fallback
    }
    siteSoundFX.playCopyConfirm();
    setCopiedSha(true);
    window.setTimeout(() => setCopiedSha(false), 1800);
  };

  const toggleMute = () => {
    siteSoundFX.muted = !sfxMuted;
    setSfxMuted(!sfxMuted);
  };

  const scrollBestiary = (dir: -1 | 1) => {
    if (!bestiaryTrackRef.current) return;
    siteSoundFX.playUiBlip();
    bestiaryTrackRef.current.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  const activeWeaponSpec = WEAPONS.find((w) => w.id === selectedWeapon) || WEAPONS[1];

  return (
    <div className="site-root">
      {/* SECTION 1 — CINEMATIC PIXEL INTRO (SKIPPABLE 2.6S SEQUENCE) */}
      {introActive && (
        <div
          className="cinematic-intro"
          role="dialog"
          aria-label="TAB RAID Cinematic Intro"
          data-testid="cinematic-intro"
        >
          <div className="intro-stage-box">
            {introStage === 1 && (
              <div className="intro-step">
                <div className="intro-terminal-line">
                  <span>&gt; SCANNING_OPEN_TABS...</span>
                  <span className="pixel-cursor-blink" />
                </div>
              </div>
            )}

            {introStage === 2 && (
              <div className="intro-step intro-glitch-shake">
                <PixelCorruptedTabIcon size={88} />
                <div className="intro-caption danger-text">WARNING: TAB MUTATION DETECTED</div>
              </div>
            )}

            {(introStage === 3 || introStage === 4) && (
              <div className="intro-step">
                <div className="intro-monster-wrap">
                  <PixelMonsterSprite
                    tier={5}
                    frame={spriteFrame}
                    size={108}
                    isHitFlashing={introStage === 4}
                  />
                  {introStage === 4 && <div className="intro-laser-beam" />}
                </div>
                <div className="intro-caption lime-text">
                  {introStage === 4 ? 'TARGET LOCKED // FIRING PULSE' : 'BROWSER BEHEMOTH SPAWNED'}
                </div>
              </div>
            )}

            {introStage === 5 && (
              <div className="intro-step intro-logo-reveal">
                <PixelBrandLogo size={76} />
                <div className="intro-wordmark">TAB RAID // MONSTER INVASION</div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="intro-skip-btn"
            onClick={() => setIntroActive(false)}
            data-testid="skip-intro-btn"
          >
            SKIP INTRO [ESC]
          </button>
        </div>
      )}

      {/* STICKY ARCADE CABINET HEADER */}
      <header className="site-navbar">
        <div className="nav-inner">
          <a href="#top" className="nav-brand">
            <PixelBrandLogo size={34} />
            <div className="nav-brand-text">
              <span className="nav-title">TAB RAID</span>
              <span className="nav-sub">MONSTER INVASION // V4.0</span>
            </div>
          </a>

          <nav className="nav-links" aria-label="Primary Navigation">
            <a href="#monsters">BESTIARY</a>
            <a href="#how-it-works">HOW IT WORKS</a>
            <a href="#armory">ARMORY</a>
            <a href="#install">INSTALL GUIDE</a>
            <a href="#privacy">SAFETY</a>
          </nav>

          <div className="nav-actions">
            <button
              type="button"
              className="btn-pixel-ghost"
              onClick={toggleMute}
              data-testid="site-sfx-toggle"
            >
              {sfxMuted ? 'SFX: OFF' : 'SFX: ON'}
            </button>
            <a
              href={LOCAL_DOWNLOAD_URL}
              download={ZIP_FILENAME}
              className="btn-pixel-lime nav-dl-btn"
              data-testid="nav-download-btn"
            >
              DOWNLOAD ZIP
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* SECTION 2 — INTERACTIVE HERO */}
        <section className="hero-section">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow-badge">
                <span className="pulse-square" /> CHROME &amp; BRAVE MANIFEST V3 EXTENSION
              </div>

              <h1 className="hero-wordmark">
                <span className="wordmark-main">TAB RAID</span>
                <span className="wordmark-sub">MONSTER INVASION</span>
              </h1>

              <div className="hero-tagline">
                <p>&ldquo;YOUR TABS HAVE MUTATED.&rdquo;</p>
                <p className="lime-text">&ldquo;HUNT THEM. CLEAR THE CHAOS.&rdquo;</p>
              </div>

              <p className="hero-subtitle">
                Turn your browser clutter into a pixel-art monster shooter. Aim with your webcam
                finger gun, defeat tab monsters, upgrade your weapons, and reclaim your browser.
              </p>

              <div className="hero-cta-row">
                <a
                  href={LOCAL_DOWNLOAD_URL}
                  download={ZIP_FILENAME}
                  className="btn-pixel-lime btn-lg"
                  data-testid="hero-download-btn"
                >
                  DOWNLOAD TAB RAID (V4.0 ZIP)
                </a>
                <a
                  href="#install"
                  className="btn-pixel-secondary btn-lg"
                  data-testid="hero-install-btn"
                >
                  HOW TO INSTALL
                </a>
              </div>

              <div className="hero-meta-strip">
                <span>PACKAGE: {ZIP_VERSION}</span>
                <span>•</span>
                <span>SIZE: 11.35 MB</span>
                <span>•</span>
                <span>100% LOCAL WEBCAM WASM</span>
              </div>
            </div>

            {/* INTERACTIVE PIXEL BATTLEFIELD STAGE */}
            <div className="hero-battlefield-wrap">
              <div className="battlefield-cabinet-bar">
                <span>LIVE HERO RANGE // CLICK THE GLITCH SLIME TO TEST FIRE</span>
                <span className="cabinet-score" data-testid="hero-demo-score">
                  DEMO SCORE: {(heroDemoHits * 100).toString().padStart(5, '0')}
                </span>
              </div>

              <div
                ref={heroStageRef}
                className="hero-battlefield"
                onMouseMove={handleHeroMouseMove}
                data-testid="hero-battlefield"
              >
                <div className="battlefield-grid-bg" />

                {/* Decorative background monsters */}
                <div className="bf-monster bf-pos-bat" aria-hidden="true">
                  <div className="bf-mini-tag">BYTE BAT // 2HP</div>
                  <PixelMonsterSprite tier={2} frame={spriteFrame} size={58} />
                </div>

                <div className="bf-monster bf-pos-crawler" aria-hidden="true">
                  <div className="bf-mini-tag">CACHE CRAWLER // 3HP</div>
                  <PixelMonsterSprite tier={3} frame={spriteFrame} size={64} />
                </div>

                <div className="bf-monster bf-pos-reaper" aria-hidden="true">
                  <div className="bf-mini-tag">RAM REAPER // 4HP</div>
                  <PixelMonsterSprite tier={4} frame={spriteFrame} size={68} />
                </div>

                <div className="bf-monster bf-pos-boss" aria-hidden="true">
                  <div className="bf-mini-tag danger-tag">BROWSER BEHEMOTH // 5HP</div>
                  <PixelMonsterSprite tier={5} frame={spriteFrame} size={86} />
                </div>

                {/* SPECIAL INTERACTIVE HERO TARGET MONSTER */}
                <button
                  type="button"
                  className={`bf-interactive-target ${heroTargetFlash ? 'bf-target-hit' : ''}`}
                  onClick={handleShootHeroMonster}
                  data-testid="hero-interactive-monster"
                  aria-label="Shoot Decorative Glitch Slime Target (+100 points)"
                >
                  <div className="bf-target-header">
                    <span className="bf-lock-pill">CLICK TO SHOOT // +100</span>
                  </div>
                  <div className="bf-target-reticle">
                    <PixelMonsterSprite
                      tier={1}
                      frame={spriteFrame}
                      size={74}
                      isHitFlashing={heroTargetFlash}
                      isHovered={true}
                    />
                  </div>
                  <div className="bf-target-nameplate">
                    <span className="np-dot">G</span>
                    <span className="np-domain">glitch-slime.tab</span>
                    <span className="np-hp">1/1 HP</span>
                  </div>
                </button>

                {/* Hero Laser Beam on Click */}
                {heroLaserActive && (
                  <svg className="bf-laser-svg" aria-hidden="true">
                    <line
                      x1="50%"
                      y1="100%"
                      x2="34%"
                      y2="52%"
                      stroke="#CCFF00"
                      strokeWidth="6"
                      strokeDasharray="10 4"
                    />
                    <line x1="50%" y1="100%" x2="34%" y2="52%" stroke="#FFFFFF" strokeWidth="2" />
                  </svg>
                )}

                {/* Pixel Debris & +100 Score Popups */}
                {heroBursts.map((b) => (
                  <div
                    key={b.id}
                    className="bf-burst-pop"
                    style={{ left: `${b.x}px`, top: `${b.y}px` }}
                    data-testid="hero-score-popup"
                  >
                    <span className="bf-score-float">+100 // TARGET HIT</span>
                    <span className="bf-spark s1" />
                    <span className="bf-spark s2" />
                    <span className="bf-spark s3" />
                    <span className="bf-spark s4" />
                  </div>
                ))}

                {/* Custom Follower Crosshair */}
                <div ref={heroCrosshairRef} className="bf-crosshair" aria-hidden="true">
                  <div className="bf-ch-box" />
                  <div className="bf-ch-dot" />
                </div>
              </div>

              <div className="battlefield-caption">
                Interactive website preview above. Your browser tabs are never accessed from this
                webpage.
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 — MEET THE MONSTERS (HORIZONTALLY SCROLLING PIXEL BESTIARY) */}
        <section id="monsters" className="section-block reveal-on-scroll">
          <div className="section-header-row">
            <div>
              <div className="section-eyebrow">01 // PROCEDURAL PIXEL BESTIARY</div>
              <h2 className="section-heading">MEET THE TAB MONSTERS</h2>
              <p className="section-desc">
                Every open browser tab materializes as one of five deterministic 16×16 pixel-art
                enemies. Difficulty uses lightweight{' '}
                <strong>estimated browser-tab threat heuristics (EST. THREAT T1–T5)</strong> based
                on page category, audible media, and discarded state—not invasive RAM or debugger
                instrumentation.
              </p>
            </div>
            <div className="bestiary-scroll-controls">
              <button
                type="button"
                className="btn-pixel-ghost"
                onClick={() => scrollBestiary(-1)}
                aria-label="Scroll bestiary left"
              >
                &lt; PREV
              </button>
              <button
                type="button"
                className="btn-pixel-ghost"
                onClick={() => scrollBestiary(1)}
                aria-label="Scroll bestiary right"
              >
                NEXT &gt;
              </button>
            </div>
          </div>

          <div
            ref={bestiaryTrackRef}
            className="bestiary-track"
            data-testid="bestiary-track"
            role="list"
          >
            {BESTIARY_MONSTERS.map((m) => {
              const isHovered = hoveredTier === m.tier;
              return (
                <article
                  key={m.id}
                  role="listitem"
                  data-testid={`bestiary-card-${m.id}`}
                  className={`bestiary-card tier-border-${m.tier}`}
                  onMouseEnter={() => {
                    setHoveredTier(m.tier);
                    siteSoundFX.playUiBlip();
                  }}
                  onMouseLeave={() => setHoveredTier(null)}
                >
                  <div className="b-card-top">
                    <span className="b-tier-badge">EST. THREAT T{m.tier}</span>
                    <span className="b-reward-badge">+{m.points} PTS / CR</span>
                  </div>

                  <div className="b-sprite-stage">
                    <PixelMonsterSprite
                      tier={m.tier}
                      frame={spriteFrame}
                      size={92}
                      isHovered={isHovered}
                    />
                  </div>

                  <div className="b-name-row">
                    <h3 className="b-monster-name">{m.name}</h3>
                    <span className="b-hp-text">{m.maxHp} HP</span>
                  </div>

                  <div className="b-hp-bar" aria-label={`${m.maxHp} Hit Points`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={`b-hp-seg ${i < m.maxHp ? 'seg-active' : 'seg-inactive'}`}
                        style={
                          i < m.maxHp
                            ? { backgroundColor: m.tier === 5 ? '#FF4D4D' : '#CCFF00' }
                            : undefined
                        }
                      />
                    ))}
                  </div>

                  <div className="b-habitat">HABITAT: {m.habitat}</div>
                  <p className="b-description">{m.description}</p>
                  <div className="b-examples">SPAWN SOURCES: {m.triggerExamples}</div>
                </article>
              );
            })}
          </div>
        </section>

        {/* SECTION 4 — HOW TAB RAID WORKS + INTERACTIVE PIXEL ARMORY */}
        <section id="how-it-works" className="section-block reveal-on-scroll">
          <div className="section-eyebrow">02 // COMBAT LOOP &amp; WEAPON PROGRESSION</div>
          <h2 className="section-heading">HOW TAB RAID WORKS</h2>

          <div className="steps-trio-grid">
            <div className="gameplay-step-card">
              <div className="g-step-header">
                <span className="g-step-num">01 — DETECT</span>
                <span className="g-step-tag">LOCAL MEDIAPIPE WASM</span>
              </div>
              <div className="g-step-visual">
                <div className="hand-skeleton-diagram">
                  <span className="sk-node sk-index" title="Index Tip Aim">
                    IDX [8]
                  </span>
                  <span className="sk-node sk-thumb" title="Thumb Trigger">
                    THM [4]
                  </span>
                  <span className="sk-status">21-POINT HAND TRACKER // 480×360</span>
                </div>
              </div>
              <h3>Enable Optical Tracking</h3>
              <p>
                Launch the fullscreen arena from your toolbar and enable the 4:3 live camera deck.
                MediaPipe Hand Landmarker runs 100% locally inside your browser via WebAssembly.
              </p>
            </div>

            <div className="gameplay-step-card">
              <div className="g-step-header">
                <span className="g-step-num">02 — AIM</span>
                <span className="g-step-tag">DIRECT-DOM CROSSHAIR</span>
              </div>
              <div className="g-step-visual">
                <div className="aim-preview-diagram">
                  <PixelMonsterSprite tier={2} frame={spriteFrame} size={58} isHovered={true} />
                  <div className="diagram-lock-box">LETHAL LOCK // -2 DMG</div>
                </div>
              </div>
              <h3>Form a Finger Gun</h3>
              <p>
                Extend your index finger to steer the zero-lag acid-lime crosshair across the
                arena. Raise your thumb to cock the hammer, or use Mouse + Spacebar at any time.
              </p>
            </div>

            <div className="gameplay-step-card">
              <div className="g-step-header">
                <span className="g-step-num">03 — ELIMINATE</span>
                <span className="g-step-tag">BOOKMARK BEFORE CLOSE</span>
              </div>
              <div className="g-step-visual">
                <div className="archive-preview-diagram">
                  <div className="archive-line">1. HP REACHES 0/5</div>
                  <div className="archive-line lime-text">
                    2. SAVED TO &ldquo;TAB RAID Archive&rdquo;
                  </div>
                  <div className="archive-line cyan-text">3. TAB CLOSED (UNDO READY)</div>
                </div>
              </div>
              <h3>Defeat &amp; Safely Archive</h3>
              <p>
                Fold your thumb down to fire. When a monster&rsquo;s HP hits zero in{' '}
                <strong>LIVE MODE</strong>, TAB RAID bookmarks the tab first and then closes it.
                One-click <strong>UNDO</strong> restores it immediately.
              </p>
            </div>
          </div>

          {/* INTERACTIVE PIXEL WEAPON ARMORY SHOWCASE */}
          <div id="armory" className="armory-showcase-box">
            <div className="armory-showcase-header">
              <div>
                <div className="section-eyebrow">IN-GAME UPGRADE SHOP</div>
                <h3 className="armory-showcase-title">
                  INTERACTIVE PIXEL ARMORY // TEST WEAPON RECOIL &amp; DAMAGE
                </h3>
                <p className="armory-showcase-sub">
                  Defeating monsters awards spendable <strong>CREDITS (CR)</strong> without reducing
                  your lifetime high score. Click any weapon below to fire at the Browser Behemoth
                  target dummy.
                </p>
              </div>
              <div className="dummy-target-widget" data-testid="armory-dummy-target">
                <div className="dummy-top-row">
                  <span>BOSS DUMMY</span>
                  <span className="lime-text">{dummyHp}/5 HP</span>
                </div>
                <div className="dummy-sprite-row">
                  <PixelMonsterSprite
                    tier={5}
                    frame={spriteFrame}
                    size={64}
                    isHitFlashing={dummyFlash}
                  />
                  {weaponFiring && (
                    <div
                      className="dummy-beam"
                      style={{
                        backgroundColor: activeWeaponSpec.laserColor,
                        height: `${activeWeaponSpec.beamWidth}px`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="armory-cards-row">
              {WEAPONS.map((w) => {
                const isSelected = selectedWeapon === w.id;
                return (
                  <div
                    key={w.id}
                    data-testid={`showcase-weapon-${w.id}`}
                    className={`showcase-weapon-card ${
                      isSelected ? 'showcase-weapon-active' : ''
                    } ${isSelected && weaponFiring ? 'weapon-recoil-kick' : ''}`}
                  >
                    <div className="sw-top">
                      <span className="sw-level">LEVEL 0{w.level}</span>
                      <span className="sw-cost">
                        {w.cost === 0 ? 'FREE STARTER' : `${w.cost} CREDITS`}
                      </span>
                    </div>

                    <div className="sw-sprite-stage">
                      <PixelWeaponSprite weaponId={w.id} size={84} />
                    </div>

                    <div className="sw-name-row">
                      <h4>{w.name}</h4>
                      <span
                        className="sw-dmg-pill"
                        style={{ color: w.laserColor, borderColor: w.laserColor }}
                      >
                        {w.damage} HP / SHOT
                      </span>
                    </div>

                    <p className="sw-tagline">{w.tagline}</p>

                    <button
                      type="button"
                      className={`btn-pixel-ghost full-w ${isSelected ? 'btn-active-lime' : ''}`}
                      onClick={() => handleTestWeaponFire(w.id)}
                      data-testid={`test-fire-${w.id}`}
                    >
                      TEST FIRE ({w.damage} DMG)
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 5 — DOWNLOAD & INTERACTIVE INSTALLATION TUTORIAL */}
        <section id="install" className="section-block reveal-on-scroll">
          <div className="section-eyebrow">03 // VERIFIED MV3 RELEASE PACKAGE</div>
          <h2 className="section-heading">DOWNLOAD &amp; 60-SECOND INSTALL GUIDE</h2>
          <p className="section-desc">
            TAB RAID is distributed as an early-access, unpacked Manifest V3 desktop extension for{' '}
            <strong>Google Chrome</strong> and <strong>Brave Browser</strong> (Developer mode
            required).
          </p>

          {/* PRIMARY PACKAGE DOWNLOAD CARD */}
          <div className="release-download-banner" data-testid="release-download-card">
            <div className="release-info-col">
              <div className="release-badge-row">
                <span className="release-pill-lime">VERIFIED BUILD // {ZIP_VERSION}</span>
                <span className="release-pill-outline">DESKTOP CHROME &amp; BRAVE</span>
              </div>
              <h3 className="release-filename">{ZIP_FILENAME}</h3>
              <p className="release-manifest-note">
                Includes <code>manifest.json</code> at root, compiled React/TypeScript arena bundle,
                custom pixel icons, and offline MediaPipe Hand Landmarker WASM + model binaries.
              </p>

              <div className="release-checksum-box">
                <div className="checksum-row">
                  <span className="checksum-label">FILE SIZE:</span>
                  <span className="checksum-val">{ZIP_SIZE_DISPLAY}</span>
                </div>
                <div className="checksum-row">
                  <span className="checksum-label">SHA-256:</span>
                  <code className="checksum-hash" data-testid="zip-sha256">
                    {ZIP_SHA256}
                  </code>
                  <button
                    type="button"
                    className="btn-copy-inline"
                    onClick={handleCopySha}
                    data-testid="copy-sha-btn"
                  >
                    {copiedSha ? 'COPIED' : 'COPY HASH'}
                  </button>
                </div>
              </div>
            </div>

            <div className="release-cta-col">
              <a
                href={LOCAL_DOWNLOAD_URL}
                download={ZIP_FILENAME}
                className="btn-pixel-lime btn-xl"
                data-testid="primary-zip-download-link"
              >
                DOWNLOAD EXTENSION ZIP
              </a>
              <a
                href={GITHUB_RELEASE_ZIP_URL}
                className="btn-pixel-secondary full-w"
                target="_blank"
                rel="noreferrer"
                data-testid="github-release-download-link"
              >
                MIRROR: GITHUB RELEASE V4.0.0
              </a>
            </div>
          </div>

          {/* INTERACTIVE BROWSER SELECTOR & STEP-BY-STEP TUTORIAL */}
          <div className="installer-tutorial-panel">
            <div className="installer-toolbar">
              <div className="browser-selector" role="tablist" aria-label="Select Browser">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedBrowser === 'brave'}
                  className={`browser-tab-btn ${selectedBrowser === 'brave' ? 'b-tab-active' : ''}`}
                  onClick={() => {
                    setSelectedBrowser('brave');
                    siteSoundFX.playUiBlip();
                  }}
                  data-testid="select-brave-btn"
                >
                  BRAVE BROWSER
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedBrowser === 'chrome'}
                  className={`browser-tab-btn ${
                    selectedBrowser === 'chrome' ? 'b-tab-active' : ''
                  }`}
                  onClick={() => {
                    setSelectedBrowser('chrome');
                    siteSoundFX.playUiBlip();
                  }}
                  data-testid="select-chrome-btn"
                >
                  GOOGLE CHROME
                </button>
              </div>

              <div className="copy-url-bar">
                <span className="copy-url-label">EXTENSIONS URL:</span>
                <code className="copy-url-code" data-testid="browser-ext-url">
                  {extUrl}
                </code>
                <button
                  type="button"
                  className="btn-pixel-lime btn-sm"
                  onClick={handleCopyExtUrl}
                  data-testid="copy-ext-url-btn"
                >
                  {copiedUrl ? 'COPIED!' : 'COPY URL'}
                </button>
              </div>
            </div>

            {/* 6-STEP INTERACTIVE PROGRESS GRID */}
            <div className="install-steps-grid">
              {INSTALL_STEPS.map((step, idx) => {
                const isCurrent = activeInstallStep === idx;
                const isCompleted = idx < activeInstallStep;
                return (
                  <button
                    key={step.num}
                    type="button"
                    className={`install-step-card ${isCurrent ? 'step-card-current' : ''} ${
                      isCompleted ? 'step-card-done' : ''
                    }`}
                    onClick={() => {
                      setActiveInstallStep(idx);
                      siteSoundFX.playUiBlip();
                    }}
                    data-testid={`install-step-${step.num}`}
                  >
                    <div className="isc-top">
                      <span className="isc-num">STEP {step.num}</span>
                      <span className="isc-state">
                        {isCurrent ? 'ACTIVE' : isCompleted ? 'DONE' : 'SELECT'}
                      </span>
                    </div>
                    <div className="isc-title">{step.title}</div>
                    <p className="isc-summary">{step.summary}</p>
                    <p className="isc-detail">{step.detail}</p>
                  </button>
                );
              })}
            </div>

            {/* EXPANDABLE TROUBLESHOOTING ACCORDION */}
            <div className="troubleshooting-box">
              <div className="ts-heading">TROUBLESHOOTING &amp; FAQ</div>
              {[
                {
                  q: 'Chrome/Brave says "Manifest file is missing or unreadable" when loading unpacked?',
                  a: 'Make sure you extracted the ZIP archive first and selected the extracted folder that directly contains manifest.json (not a parent wrapper folder or the .zip file itself).',
                },
                {
                  q: 'The webcam preview says "CAMERA PERMISSION DENIED"?',
                  a: 'Click the site settings / lock icon in the browser address bar while on the TAB RAID arena tab, set Camera to "Allow", and click RETRY ENABLE CAMERA. You can also play with Mouse + Spacebar at any time.',
                },
                {
                  q: 'Will shooting monsters close my real tabs immediately?',
                  a: 'No. TAB RAID always launches in SAFE MODE, where monster defeats are simulated. Real tabs are only bookmarked and closed when you explicitly toggle LIVE MODE in the top HUD.',
                },
              ].map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={idx} className="faq-item">
                    <button
                      type="button"
                      className="faq-question"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                    >
                      <span>{item.q}</span>
                      <span className="faq-icon">{isOpen ? '[-]' : '[+]'}</span>
                    </button>
                    {isOpen && <div className="faq-answer">{item.a}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 6 — PRIVACY & SAFETY ARCHITECTURE */}
        <section id="privacy" className="section-block reveal-on-scroll">
          <div className="section-eyebrow">04 //TRANSPARENT PERMISSIONS &amp; SAFETY GATES</div>
          <h2 className="section-heading">BUILT FOR REAL BROWSERS. ZERO DATA LEAKS.</h2>

          <div className="privacy-grid">
            <div className="privacy-card">
              <div className="p-card-tag lime-text">100% LOCAL VISION</div>
              <h3>Camera Stays On-Device</h3>
              <p>
                Webcam frames are processed directly in memory by locally bundled MediaPipe WASM and{' '}
                <code>hand_landmarker.task</code> assets. No video frames, images, or browsing URLs
                are ever transmitted over the network.
              </p>
            </div>

            <div className="privacy-card">
              <div className="p-card-tag cyan-text">DEFAULT SAFE MODE</div>
              <h3>Explicit Live-Mode Arming</h3>
              <p>
                Every session starts in <strong>SAFE MODE</strong>. Pinned tabs, Chrome/Brave
                internal pages, and the TAB RAID arena tab itself are automatically excluded from
                targeting.
              </p>
            </div>

            <div className="privacy-card">
              <div className="p-card-tag amber-text">BOOKMARK-BEFORE-CLOSE</div>
              <h3>Verified Archive &amp; Instant Undo</h3>
              <p>
                In <strong>LIVE MODE</strong>, a tab is only closed after its monster reaches 0 HP
                and <code>chrome.bookmarks.create()</code> succeeds inside the{' '}
                <strong>TAB RAID Archive</strong> folder. Click <strong>UNDO</strong> to reopen it.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 7 — FINAL CTA / ARCADE FOOTER */}
        <section className="final-cta-section reveal-on-scroll">
          <div className="final-arcade-box">
            <div className="final-monsters-parade" aria-hidden="true">
              <PixelMonsterSprite tier={1} frame={spriteFrame} size={48} />
              <PixelMonsterSprite tier={2} frame={spriteFrame} size={54} />
              <PixelMonsterSprite tier={3} frame={spriteFrame} size={60} />
              <PixelMonsterSprite tier={4} frame={spriteFrame} size={66} />
              <PixelMonsterSprite tier={5} frame={spriteFrame} size={78} />
            </div>

            <h2 className="final-headline">READY TO CLEAR THE CHAOS?</h2>
            <p className="final-sub">
              Load the unpacked Manifest V3 extension in Chrome or Brave and turn your 40 open tabs
              into an arcade boss rush.
            </p>

            <div className="hero-cta-row justify-center">
              <a
                href={LOCAL_DOWNLOAD_URL}
                download={ZIP_FILENAME}
                className="btn-pixel-lime btn-xl"
                data-testid="footer-download-btn"
              >
                DOWNLOAD TAB RAID ({ZIP_VERSION})
              </a>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-pixel-secondary btn-xl"
                data-testid="footer-github-btn"
              >
                VIEW SOURCE ON GITHUB
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand-col">
            <div className="nav-brand">
              <PixelBrandLogo size={28} />
              <span className="nav-title">TAB RAID // MONSTER INVASION</span>
            </div>
            <p className="footer-note">
              Built for DevFest Hackathon. Manifest V3 Chrome &amp; Brave extension powered by
              React, TypeScript, Vite, Web Audio API, and local MediaPipe Hand Landmarker.
            </p>
          </div>

          <div className="footer-links-col">
            <div>
              <strong>PERMISSIONS:</strong> <code>tabs</code>, <code>bookmarks</code>,{' '}
              <code>storage</code> + local webcam opt-in.
            </div>
            <div>
              <strong>REPOSITORY:</strong>{' '}
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                github.com/sinagdevv/tabRaid
              </a>
            </div>
            <div>
              <strong>RELEASE ASSET:</strong>{' '}
              <a href={LOCAL_DOWNLOAD_URL} download={ZIP_FILENAME}>
                {ZIP_FILENAME}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
