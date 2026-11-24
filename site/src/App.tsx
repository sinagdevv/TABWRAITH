import React, { useEffect, useRef, useState } from 'react';
import {
  BESTIARY_MONSTERS,
  WEAPONS,
  WeaponId,
  PixelMonsterSprite,
  PixelWeaponSprite,
  PixelBrandLogo,
  PixelCorruptedTabIcon,
} from './PixelSprites';
import { siteSoundFX } from './siteSoundFX';

const ZIP_FILENAME = 'tabwraith-v5.2.0-extension.zip';
const ZIP_VERSION = '5.2.0';
// The lead fills this in once the final ZIP exists.
const ZIP_SIZE_LABEL = '11.6 MB';
const RELEASE_DOWNLOAD_URL = 'https://github.com/sinagdevv/tabRaid/releases/download/v5.2.0/tabwraith-v5.2.0-extension.zip';
const GITHUB_REPO_URL = 'https://github.com/sinagdevv/tabRaid';

interface Fx {
  id: number;
  x: number;
  y: number;
  big: boolean;
}

const FLAVOR: Record<number, string> = {
  1: 'Faint residue of a forgotten page. One shot ends it.',
  2: 'A restless winged shade. Two hits to bring it down.',
  3: 'Armored and patient. It takes three hits to break.',
  4: 'Its scythe is slow, its hunger is not. Four hits.',
  5: 'The apex of the crypt. Five hits of sustained fire.',
};

const RANGE_SPOTS = [
  { tier: 1 as const, x: 4, y: 58, size: 64 },
  { tier: 2 as const, x: 30, y: 8, size: 64 },
  { tier: 3 as const, x: 33, y: 56, size: 72 },
  { tier: 4 as const, x: 62, y: 8, size: 72 },
  { tier: 5 as const, x: 62, y: 48, size: 92 },
];

const GESTURES = [
  {
    name: 'HEXCASTER',
    steps: ['Point your index finger', 'Raise your thumb to cock', 'Fold your thumb to fire'],
  },
  {
    name: 'SOUL BURST',
    steps: ['Make a fist', 'Open your palm', 'Hold it briefly'],
  },
  {
    name: 'WRAITHBLADE',
    steps: ['Raise index and middle fingers', 'Fold ring and pinky', 'Hold briefly to slash'],
  },
];

const RELICS = ['Wraith Crown', 'Crimson Knight', 'Ashen Hunter', 'Sunfall Paladin', 'Void Sorcerer'];

const PERMISSIONS = [
  ['tabs', 'See and manage your open tabs.'],
  ['tabGroups', 'Read native tab groups so they can become legions.'],
  ['bookmarks', 'Bookmark a tab before it is closed.'],
  ['storage', 'Keep the Soul Archive in local extension storage.'],
  ['camera', 'Optional. Only if you enable the webcam.'],
];

const INSTALL_STEPS = [
  { num: '01', title: 'DOWNLOAD AND UNZIP', summary: `Download ${ZIP_FILENAME} and unzip it into a folder you will keep.`, detail: 'The folder must stay in place while the extension is installed.' },
  { num: '02', title: 'OPEN EXTENSIONS', summary: 'Open brave://extensions or chrome://extensions in the address bar.', detail: 'Use the copy buttons above, then paste into a new tab.' },
  { num: '03', title: 'DEVELOPER MODE', summary: 'Switch on Developer mode, top right of the page.', detail: 'Needed because this build is loaded unpacked.' },
  { num: '04', title: 'LOAD UNPACKED', summary: 'Click Load unpacked and choose the folder that contains manifest.json.', detail: 'Not the ZIP itself and not a parent folder.' },
  { num: '05', title: 'PIN THE ICON', summary: 'Open the puzzle-piece menu and pin TABWRAITH.', detail: 'Click the crest to enter the arena.' },
];

const FAQ = [
  {
    q: 'Chrome says "Manifest file is missing or unreadable"?',
    a: 'Select the unzipped folder that directly contains manifest.json, not the ZIP and not a wrapper folder.',
  },
  {
    q: 'Camera permission was denied?',
    a: 'Allow Camera for the extension page in your browser site settings and retry. The webcam is optional.',
  },
  {
    q: 'Will a shot close my real tabs?',
    a: 'Not in SAFE mode, which is the default. SAFE mode only simulates. Closing real tabs needs LIVE mode, and a tab is bookmarked first, with Undo available.',
  },
];

const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 0.7) % 6,
  dur: 5 + ((i * 13) % 5),
}));

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Pixel castle silhouette built from rects (crenellated towers). */
const Castle: React.FC<{ x: number; w: number; h: number; fill: string }> = ({ x, w, h, fill }) => (
  <g fill={fill}>
    <rect x={x} y={90 - h} width={w} height={h} />
    {Array.from({ length: Math.floor(w / 4) }, (_, i) => (
      <rect key={i} x={x + i * 4} y={90 - h - 2} width={2} height={2} />
    ))}
    <rect x={x + w / 2 - 3} y={90 - h - 12} width={6} height={12} />
    <rect x={x + w / 2 - 1} y={90 - h - 16} width={2} height={4} />
  </g>
);

const HeroScene: React.FC = () => (
  <div className="scene" aria-hidden="true">
    <svg className="scene-svg scene-far" viewBox="0 0 160 90" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges">
      <g transform="translate(-48 26)"><g fill="#E9DFCF" opacity="0.08"><rect x="117" y="9" width="30" height="30" /></g>
      <g fill="#B44653">
        <rect x="122" y="12" width="20" height="24" />
        <rect x="119" y="16" width="26" height="16" />
        <rect x="125" y="9" width="14" height="30" />
      </g>
      <g fill="#8e3340"><rect x="128" y="18" width="4" height="4" /><rect x="134" y="26" width="3" height="3" /></g></g>
      <Castle x={8} w={22} h={28} fill="#1a1520" />
      <Castle x={96} w={26} h={22} fill="#1a1520" />
      <Castle x={138} w={18} h={34} fill="#1a1520" />
    </svg>
    <svg className="scene-svg scene-near" viewBox="0 0 160 90" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges">
      <Castle x={44} w={30} h={14} fill="#130f19" />
      <rect x="0" y="80" width="160" height="10" fill="#0a0810" />
      {[6, 28, 51, 76, 102, 125, 148].map((x) => (
        <rect key={x} x={x} y="76" width="2" height="6" fill="#0a0810" />
      ))}
    </svg>
    <div className="fog fog-a" />
    <div className="fog fog-b" />
    {EMBERS.map((e, i) => (
      <span key={i} className="ember" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s` }} />
    ))}
  </div>
);

export const App: React.FC = () => {
  const [introActive, setIntroActive] = useState<boolean>(() => !reduced());
  const [introStage, setIntroStage] = useState<number>(1);
  const [spriteFrame, setSpriteFrame] = useState<0 | 1>(0);
  const [sfxMuted, setSfxMuted] = useState<boolean>(false);

  // Range (decorative shooting preview)
  const rangeRef = useRef<HTMLDivElement | null>(null);
  const [hp, setHp] = useState<number[]>(RANGE_SPOTS.map((m) => m.tier));
  const [flash, setFlash] = useState<number | null>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const [score, setScore] = useState(0);

  const [hoveredTier, setHoveredTier] = useState<number | null>(null);
  const bestiaryTrackRef = useRef<HTMLDivElement | null>(null);

  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>('double-barrel');
  const [weaponFiring, setWeaponFiring] = useState<boolean>(false);
  const [dummyHp, setDummyHp] = useState<number>(5);
  const [dummyFlash, setDummyFlash] = useState<boolean>(false);

  const [selectedBrowser, setSelectedBrowser] = useState<'chrome' | 'brave'>('brave');
  const [activeInstallStep, setActiveInstallStep] = useState<number>(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  useEffect(() => {
    if (!introActive) return;
    const ts = [
      window.setTimeout(() => setIntroStage(2), 400),
      window.setTimeout(() => setIntroStage(3), 900),
      window.setTimeout(() => setIntroStage(4), 1450),
      window.setTimeout(() => setIntroStage(5), 1850),
      window.setTimeout(() => setIntroActive(false), 2600),
    ];
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIntroActive(false);
    window.addEventListener('keydown', onKey);
    return () => {
      ts.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    };
  }, [introActive]);

  useEffect(() => {
    if (reduced()) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) setSpriteFrame((p) => (p === 0 ? 1 : 0));
    }, 380);
    return () => clearInterval(interval);
  }, []);

  // Scroll reveal (content is visible by default without IntersectionObserver or with reduced motion)
  useEffect(() => {
    const els = document.querySelectorAll('.reveal-on-scroll');
    if (typeof IntersectionObserver === 'undefined' || reduced()) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            io.unobserve(en.target);
          }
        }),
      { threshold: 0, rootMargin: "0px 0px 8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Restrained parallax: one CSS variable, rAF-throttled
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--scroll-y', String(Math.min(window.scrollY, 700)));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const addFx = (x: number, y: number, big: boolean) => {
    const id = Date.now() + Math.random();
    setFx((p) => [...p.slice(-6), { id, x, y, big }]);
    window.setTimeout(() => setFx((p) => p.filter((f) => f.id !== id)), big ? 800 : 500);
  };

  const shootAt = (e: React.MouseEvent, idx: number | null) => {
    const r = rangeRef.current?.getBoundingClientRect();
    const x = r ? e.clientX - r.left : 0;
    const y = r ? e.clientY - r.top : 0;
    if (idx === null) {
      siteSoundFX.playUiBlip();
      addFx(x, y, false);
      return;
    }
    e.stopPropagation();
    const next = hp[idx] - 1;
    siteSoundFX.playHeroShot();
    setFlash(idx);
    window.setTimeout(() => setFlash(null), 140);
    addFx(x, y, next <= 0);
    setHp((p) => p.map((v, i) => (i === idx ? Math.max(0, next) : v)));
    if (next <= 0) {
      setScore((s) => s + BESTIARY_MONSTERS[idx].points);
      window.setTimeout(() => setHp((p) => p.map((v, i) => (i === idx ? RANGE_SPOTS[idx].tier : v))), 1800);
    }
  };

  const handleTestWeaponFire = (weaponId: WeaponId) => {
    const spec = WEAPONS.find((w) => w.id === weaponId) || WEAPONS[0];
    setSelectedWeapon(weaponId);
    setWeaponFiring(true);
    setDummyFlash(true);
    siteSoundFX.playWeaponFire(spec.level);
    setDummyHp((prev) => (prev - spec.damage <= 0 ? 5 : prev - spec.damage));
    window.setTimeout(() => setWeaponFiring(false), 150);
    window.setTimeout(() => setDummyFlash(false), 170);
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be blocked on insecure origins */
    }
    siteSoundFX.playCopyConfirm();
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const toggleMute = () => {
    siteSoundFX.muted = !sfxMuted;
    setSfxMuted(!sfxMuted);
  };

  const scrollBestiary = (dir: -1 | 1) => {
    siteSoundFX.playUiBlip();
    bestiaryTrackRef.current?.scrollBy({ left: dir * 340, behavior: reduced() ? 'auto' : 'smooth' });
  };

  const activeWeaponSpec = WEAPONS.find((w) => w.id === selectedWeapon) || WEAPONS[1];
  const dlProps = { href: RELEASE_DOWNLOAD_URL, rel: 'noreferrer' };

  return (
    <div className="site-root">
      {introActive && (
        <div className="cinematic-intro" role="dialog" aria-label="TABWRAITH intro" data-testid="cinematic-intro">
          <div className="intro-stage-box">
            {introStage === 1 && (
              <div className="intro-step">
                <div className="intro-terminal-line">
                  <span>&gt; SCANNING OPEN TABS</span>
                  <span className="pixel-cursor-blink" />
                </div>
              </div>
            )}
            {introStage === 2 && (
              <div className="intro-step intro-glitch-shake">
                <PixelCorruptedTabIcon size={88} />
                <div className="intro-caption danger-text">A CURSE STIRS IN YOUR TABS</div>
              </div>
            )}
            {(introStage === 3 || introStage === 4) && (
              <div className="intro-step">
                <div className="intro-monster-wrap">
                  <PixelMonsterSprite tier={5} frame={spriteFrame} size={108} isHitFlashing={introStage === 4} />
                  {introStage === 4 && <div className="intro-laser-beam" />}
                </div>
                <div className="intro-caption lime-text">
                  {introStage === 4 ? 'HEXCASTER FIRES' : 'THE ABYSSAL BEHEMOTH RISES'}
                </div>
              </div>
            )}
            {introStage === 5 && (
              <div className="intro-step intro-logo-reveal">
                <PixelBrandLogo size={76} />
                <div className="intro-wordmark">TABWRAITH</div>
              </div>
            )}
          </div>
          <button type="button" className="intro-skip-btn" onClick={() => setIntroActive(false)} data-testid="skip-intro-btn">
            SKIP INTRO [ESC]
          </button>
        </div>
      )}

      <header className="site-navbar">
        <div className="nav-inner">
          <a href="#top" className="nav-brand">
            <PixelBrandLogo size={34} />
            <div className="nav-brand-text">
              <span className="nav-title">TABWRAITH</span>
              <span className="nav-sub">CURSE OF THE OPEN TABS · V{ZIP_VERSION}</span>
            </div>
          </a>
          <nav className="nav-links" aria-label="Primary Navigation">
            <a href="#monsters">BESTIARY</a>
            <a href="#combat">COMBAT</a>
            <a href="#legions">LEGIONS</a>
            <a href="#install">INSTALL</a>
            <a href="#privacy">PRIVACY</a>
          </nav>
          <div className="nav-actions">
            <button type="button" className="btn-pixel-ghost" onClick={toggleMute} data-testid="site-sfx-toggle">
              {sfxMuted ? 'SFX: OFF' : 'SFX: ON'}
            </button>
            <a {...dlProps} className="btn-pixel-lime nav-dl-btn" data-testid="nav-download-btn">
              DOWNLOAD
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero-section hero-v2">
          <HeroScene />
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="hero-crest">
                <PixelBrandLogo size={96} />
              </div>
              <div className="eyebrow-badge">CHROME &amp; BRAVE EXTENSION · EXPERIMENTAL</div>
              <h1 className="hero-wordmark">
                <span className="wordmark-main">TABWRAITH</span>
                <span className="wordmark-sub">CURSE OF THE OPEN TABS</span>
              </h1>
              <div className="hero-tagline">
                <p>&ldquo;The tabs you forgot have returned.&rdquo;</p>
              </div>
              <p className="hero-subtitle">
                Your open tabs rise as pixel monsters. Aim with the mouse or, if you choose, your
                webcam, break the curse, and reclaim your browser.
              </p>
              <div className="hero-cta-row">
                <a {...dlProps} className="btn-pixel-lime btn-lg" data-testid="hero-download-btn">
                  DOWNLOAD V{ZIP_VERSION}
                </a>
                <a href="#install" className="btn-pixel-secondary btn-lg" data-testid="hero-install-btn">
                  HOW TO INSTALL
                </a>
              </div>
              <div className="hero-meta-strip">
                <span>ZIP {ZIP_SIZE_LABEL}</span>
                <span>DESKTOP CHROME OR BRAVE</span>
                <span>NO ACCOUNT, NO BACKEND</span>
              </div>
            </div>

            <div className="hero-battlefield-wrap">
              <div className="battlefield-cabinet-bar">
                <span>SHOOTING RANGE · CLICK THE MONSTERS</span>
                <span className="cabinet-score" data-testid="hero-demo-score">
                  SCORE {score.toString().padStart(5, '0')}
                </span>
              </div>
              <div
                ref={rangeRef}
                className="range"
                onClick={(e) => shootAt(e, null)}
                data-testid="hero-battlefield"
              >
                {RANGE_SPOTS.map((m, i) => {
                  const dead = hp[i] <= 0;
                  return (
                    <button
                      key={m.tier}
                      type="button"
                      className={`range-mon idle-${i % 3} ${dead ? 'is-dead' : ''}`}
                      style={{ left: `${m.x}%`, top: `${m.y}%` }}
                      onClick={(e) => shootAt(e, i)}
                      disabled={dead}
                      data-testid={i === 0 ? 'hero-interactive-monster' : undefined}
                      aria-label={`Shoot ${BESTIARY_MONSTERS[i].name}, ${hp[i]} of ${m.tier} HP left (decorative)`}
                    >
                      <PixelMonsterSprite tier={m.tier} frame={spriteFrame} size={m.size} isHitFlashing={flash === i} />
                      <span className="range-hp">
                        {Array.from({ length: m.tier }, (_, k) => (
                          <i key={k} className={k < hp[i] ? 'on' : ''} />
                        ))}
                      </span>
                    </button>
                  );
                })}
                {fx.map((f) => {
                  const n = f.big ? 12 : 6;
                  const rad = f.big ? 46 : 22;
                  return (
                    <div key={f.id} className={`px-burst ${f.big ? 'big' : ''}`} style={{ left: f.x, top: f.y }} data-testid="hero-score-popup">
                      {Array.from({ length: n }, (_, k) => (
                        <i
                          key={k}
                          style={
                            {
                              '--dx': `${Math.round(Math.cos((k / n) * 6.283) * rad)}px`,
                              '--dy': `${Math.round(Math.sin((k / n) * 6.283) * rad)}px`,
                              background: ['#B44653', '#CA955C', '#E9DFCF'][k % 3],
                            } as React.CSSProperties
                          }
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="battlefield-caption">
                A decorative preview. This page never touches your real tabs.
              </div>
            </div>
          </div>
        </section>

        <section id="monsters" className="section-block reveal-on-scroll">
          <div className="section-header-row">
            <div>
              <div className="section-eyebrow">I. THE BESTIARY</div>
              <h2 className="section-heading">FIVE CURSED TABS</h2>
              <p className="section-desc">
                Tabs rise as one of five monsters. Their tiers are <strong>ESTIMATED threat
                heuristics</strong>, not measured RAM or CPU usage. Treat them as flavor, not a
                benchmark.
              </p>
            </div>
            <div className="bestiary-scroll-controls">
              <button type="button" className="btn-pixel-ghost" onClick={() => scrollBestiary(-1)} aria-label="Scroll bestiary left">
                &lt; PREV
              </button>
              <button type="button" className="btn-pixel-ghost" onClick={() => scrollBestiary(1)} aria-label="Scroll bestiary right">
                NEXT &gt;
              </button>
            </div>
          </div>
          <div ref={bestiaryTrackRef} className="bestiary-track" data-testid="bestiary-track" role="list">
            {BESTIARY_MONSTERS.map((m) => (
              <article
                key={m.id}
                role="listitem"
                data-testid={`bestiary-card-${m.id}`}
                className={`bestiary-card tier-border-${m.tier}`}
                onMouseEnter={() => setHoveredTier(m.tier)}
                onMouseLeave={() => setHoveredTier(null)}
              >
                <div className="b-card-top">
                  <span className="b-tier-badge">EST. THREAT {m.tier}</span>
                  <span className="b-reward-badge">{m.points} PTS</span>
                </div>
                <div className="b-sprite-stage">
                  <PixelMonsterSprite tier={m.tier} frame={spriteFrame} size={92} isHovered={hoveredTier === m.tier} />
                </div>
                <div className="b-name-row">
                  <h3 className="b-monster-name">{m.name}</h3>
                  <span className="b-hp-text">{m.maxHp} HP</span>
                </div>
                <div className="b-hp-bar" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={`b-hp-seg ${i < m.maxHp ? 'seg-active' : 'seg-inactive'}`}
                      style={i < m.maxHp ? { backgroundColor: m.tier === 5 ? '#B44653' : '#CA955C' } : undefined}
                    />
                  ))}
                </div>
                <p className="b-description">{FLAVOR[m.tier]}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="combat" className="section-block reveal-on-scroll">
          <div className="section-eyebrow">II. COMBAT</div>
          <h2 className="section-heading">THREE GESTURES, ONE MOUSE</h2>
          <p className="section-desc">
            Gesture combat is <strong>experimental</strong> and depends on your webcam, lighting and
            hand position. Accuracy is not guaranteed. The mouse always works.
          </p>
          <div className="gesture-row">
            {GESTURES.map((g) => (
              <div key={g.name} className="gesture-plate">
                <h3>{g.name}</h3>
                <ol>
                  {g.steps.map((st) => (
                    <li key={st}>{st}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div id="armory" className="armory-showcase-box">
            <div className="armory-showcase-header">
              <div>
                <div className="section-eyebrow">THE BLACKSMITH</div>
                <h3 className="armory-showcase-title">FORGE A BETTER WEAPON</h3>
                <p className="armory-showcase-sub">
                  Spend credits earned from kills. Test fire each weapon at the dummy.
                </p>
              </div>
              <div className="dummy-target-widget" data-testid="armory-dummy-target">
                <div className="dummy-top-row">
                  <span>DUMMY</span>
                  <span className="lime-text">{dummyHp}/5 HP</span>
                </div>
                <div className="dummy-sprite-row">
                  <PixelMonsterSprite tier={5} frame={spriteFrame} size={64} isHitFlashing={dummyFlash} />
                  {weaponFiring && (
                    <div className="dummy-beam" style={{ backgroundColor: activeWeaponSpec.laserColor, height: `${activeWeaponSpec.beamWidth}px` }} />
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
                    className={`showcase-weapon-card ${isSelected ? 'showcase-weapon-active' : ''} ${isSelected && weaponFiring ? 'weapon-recoil-kick' : ''}`}
                  >
                    <div className="sw-top">
                      <span className="sw-level">TIER {w.level}</span>
                      <span className="sw-cost">{w.cost === 0 ? 'FREE' : `${w.cost} CREDITS`}</span>
                    </div>
                    <div className="sw-sprite-stage">
                      <PixelWeaponSprite weaponId={w.id} size={84} />
                    </div>
                    <div className="sw-name-row">
                      <h4>{w.name}</h4>
                      <span className="sw-dmg-pill" style={{ color: w.laserColor, borderColor: w.laserColor }}>
                        {w.damage} DMG
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`btn-pixel-ghost full-w ${isSelected ? 'btn-active-lime' : ''}`}
                      onClick={() => handleTestWeaponFire(w.id)}
                      data-testid={`test-fire-${w.id}`}
                    >
                      TEST FIRE
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="relic-strip">
              <strong>HERO RELICS</strong>
              <span>{RELICS.join(' · ')}</span>
              <em>Cosmetic only. Optional local face tracking. No gameplay advantage.</em>
            </div>
          </div>
        </section>

        <section id="legions" className="section-block reveal-on-scroll">
          <div className="section-eyebrow">III. THE LEGIONS</div>
          <h2 className="section-heading">TAB GROUPS BECOME ARMIES</h2>
          <div className="ledger">
            <div className="ledger-item">
              <h3>Cursed Legions</h3>
              <p>
                Your native Chrome or Brave tab groups become monster legions. A shot only affects
                its own tab. Legion bosses are visual and are never closed by a shot.
              </p>
            </div>
            <div className="ledger-item">
              <h3>Soul Archive</h3>
              <p>
                Save a group&rsquo;s URLs, title, color and order to local extension storage.
                Restoring reopens the URLs as a native group. Unsaved page state is not restored.
                Group cleanup needs LIVE mode, a review dialog, and archives first.
              </p>
            </div>
            <div className="ledger-item">
              <h3>SAFE and LIVE</h3>
              <p>
                SAFE is the default and only simulates. Real tab changes need LIVE mode, which you
                switch on yourself.
              </p>
            </div>
            <div className="ledger-item">
              <h3>Bookmark first, Undo after</h3>
              <p>A tab is bookmarked before it is closed, and Undo brings it back.</p>
            </div>
          </div>
        </section>

        <section id="install" className="section-block reveal-on-scroll">
          <div className="section-eyebrow">IV. INSTALL</div>
          <h2 className="section-heading">DOWNLOAD AND LOAD UNPACKED</h2>
          <p className="section-desc">
            TABWRAITH {ZIP_VERSION} is an unpacked extension for <strong>desktop Chrome or Brave</strong>.
          </p>
          <p className="mobile-note">On a phone or tablet? Come back on a desktop. The extension cannot run on mobile browsers.</p>

          <div className="release-download-banner" data-testid="release-download-card">
            <div className="release-info-col">
              <h3 className="release-filename">{ZIP_FILENAME}</h3>
              <p className="release-manifest-note">
                Version {ZIP_VERSION} · Size {ZIP_SIZE_LABEL}. Contains <code>manifest.json</code> at the top level.
              </p>
            </div>
            <div className="release-cta-col">
              <a {...dlProps} className="btn-pixel-lime btn-xl" data-testid="primary-zip-download-link">
                DOWNLOAD ZIP
              </a>
            </div>
          </div>

          <div className="installer-tutorial-panel">
            <div className="installer-toolbar">
              <div className="browser-selector" role="tablist" aria-label="Select Browser">
                {(['brave', 'chrome'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="tab"
                    aria-selected={selectedBrowser === b}
                    className={`browser-tab-btn ${selectedBrowser === b ? 'b-tab-active' : ''}`}
                    onClick={() => setSelectedBrowser(b)}
                    data-testid={`select-${b}-btn`}
                  >
                    {b.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="copy-url-bar">
                {['brave://extensions', 'chrome://extensions'].map((u) => (
                  <span key={u} className="copy-pair">
                    <code className="copy-url-code" data-testid={u.startsWith(selectedBrowser) ? 'browser-ext-url' : undefined}>{u}</code>
                    <button type="button" className="btn-pixel-lime btn-sm" onClick={() => copy(u, u)} data-testid={`copy-${u.split(':')[0]}-btn`}>
                      {copied === u ? 'COPIED' : 'COPY'}
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="install-steps-grid">
              {INSTALL_STEPS.map((step, idx) => {
                const isCurrent = activeInstallStep === idx;
                return (
                  <button
                    key={step.num}
                    type="button"
                    className={`install-step-card ${isCurrent ? 'step-card-current' : ''} ${idx < activeInstallStep ? 'step-card-done' : ''}`}
                    onClick={() => setActiveInstallStep(idx)}
                    data-testid={`install-step-${step.num}`}
                  >
                    <div className="isc-top">
                      <span className="isc-num">STEP {step.num}</span>
                    </div>
                    <div className="isc-title">{step.title}</div>
                    <p className="isc-summary">{step.summary}</p>
                    <p className="isc-detail">{step.detail}</p>
                  </button>
                );
              })}
            </div>

            <div className="troubleshooting-box">
              <div className="ts-heading">TROUBLESHOOTING</div>
              {FAQ.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={idx} className="faq-item">
                    <button type="button" className="faq-question" onClick={() => setOpenFaqIdx(isOpen ? null : idx)} aria-expanded={isOpen}>
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

        <section id="privacy" className="section-block reveal-on-scroll">
          <div className="section-eyebrow">V. PERMISSIONS AND PRIVACY</div>
          <h2 className="section-heading">WHAT IT ASKS FOR, AND WHY</h2>
          <div className="privacy-grid">
            <div className="privacy-card perm-list">
              <h3>Permissions</h3>
              <ul>
                {PERMISSIONS.map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code> {v}
                  </li>
                ))}
              </ul>
            </div>
            <div className="privacy-card">
              <h3>Webcam is opt-in</h3>
              <p>
                Frames are processed locally in the browser by bundled MediaPipe models. They are
                never recorded or uploaded.
              </p>
            </div>
            <div className="privacy-card">
              <h3>No backend, no accounts</h3>
              <p>Everything stays on your machine, in your browser. SAFE mode is the default.</p>
            </div>
          </div>
        </section>

        <section className="final-cta-section reveal-on-scroll">
          <div className="final-arcade-box">
            <div className="final-monsters-parade" aria-hidden="true">
              {BESTIARY_MONSTERS.map((m) => (
                <PixelMonsterSprite key={m.id} tier={m.tier} frame={spriteFrame} size={44 + m.tier * 8} />
              ))}
            </div>
            <h2 className="final-headline">BREAK THE CURSE</h2>
            <div className="hero-cta-row justify-center">
              <a {...dlProps} className="btn-pixel-lime btn-xl" data-testid="footer-download-btn">
                DOWNLOAD V{ZIP_VERSION}
              </a>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="btn-pixel-secondary btn-xl" data-testid="footer-github-btn">
                VIEW SOURCE
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
              <span className="nav-title">TABWRAITH</span>
            </div>
            <p className="footer-note">Gesture combat is experimental. Desktop Chrome or Brave only.</p>
          </div>
          <div className="footer-links-col">
            <div>
              <strong>PERMISSIONS:</strong> <code>tabs</code>, <code>tabGroups</code>, <code>bookmarks</code>, <code>storage</code>, optional camera
            </div>
            <div>
              <a {...dlProps}>{ZIP_FILENAME}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
