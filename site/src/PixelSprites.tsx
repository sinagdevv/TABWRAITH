import React from 'react';

export type ThreatTier = 1 | 2 | 3 | 4 | 5;

export type MonsterArchetypeId =
  | 'glitch-slime'
  | 'byte-bat'
  | 'cache-crawler'
  | 'ram-reaper'
  | 'browser-behemoth';

export interface MonsterBestiarySpec {
  id: MonsterArchetypeId;
  name: string;
  tier: ThreatTier;
  maxHp: number;
  points: number;
  primaryColor: string;
  secondaryColor: string;
  eyeColor: string;
  habitat: string;
  description: string;
  triggerExamples: string;
}

export const BESTIARY_MONSTERS: MonsterBestiarySpec[] = [
  {
    id: 'glitch-slime',
    name: 'Ashling',
    tier: 1,
    maxHp: 1,
    points: 100,
    primaryColor: '#7BAA9B',
    secondaryColor: '#3F6359',
    eyeColor: '#B44653',
    habitat: 'Discarded & Static Reference Tabs',
    description:
      'Low-threat cursed tab residue that spawns from forgotten documentation pages and idle search tabs. Eliminated in a single Rustbound Relic pulse.',
    triggerExamples: 'MDN Docs, static articles, background reference tabs',
  },
  {
    id: 'byte-bat',
    name: 'Gloomwing',
    tier: 2,
    maxHp: 2,
    points: 250,
    primaryColor: '#7A6A9B',
    secondaryColor: '#3E3258',
    eyeColor: '#CA955C',
    habitat: 'Forums, Q&A Threads & Social Feeds',
    description:
      'Erratic winged packet-scavenger that swoops between rabbit-hole threads. Moves quickly across the arena and takes two standard shots—or one Twin Hexcasters blast.',
    triggerExamples: 'Stack Overflow, Hacker News, Reddit threads',
  },
  {
    id: 'cache-crawler',
    name: 'Crypt Crawler',
    tier: 3,
    maxHp: 3,
    points: 450,
    primaryColor: '#B3A27E',
    secondaryColor: '#5E4F38',
    eyeColor: '#B44653',
    habitat: 'Local Dev Servers & Active Repositories',
    description:
      'Armored mechanical arachnid nested inside active localhost ports and sprawling pull requests. Its hardened carapace absorbs up to 3 HP of laser fire.',
    triggerExamples: 'localhost:5173, GitHub PRs, CI/CD dashboards',
  },
  {
    id: 'ram-reaper',
    name: 'Soul Reaper',
    tier: 4,
    maxHp: 4,
    points: 700,
    primaryColor: '#E9DFCF',
    secondaryColor: '#8A7F73',
    eyeColor: '#B44653',
    habitat: 'Cloud Consoles & Collaborative Editors',
    description:
      'Glitching cybernetic skull forged from multi-collaborator documents and heavyweight cloud dashboards. Rewards 700 credits upon elimination.',
    triggerExamples: 'Google Docs, Cloud Consoles, Slack/Discord web apps',
  },
  {
    id: 'browser-behemoth',
    name: 'Abyssal Behemoth',
    tier: 5,
    maxHp: 5,
    points: 1000,
    primaryColor: '#B44653',
    secondaryColor: '#5C1F2B',
    eyeColor: '#CA955C',
    habitat: '4K Streams, Infinite Canvases & Audible Media',
    description:
      'Apex demon bound from 14-hour background video streams and massive design canvases. Demands 5 HP of sustained fire—upgrade to the Abyssal Cannon to hunt it fast.',
    triggerExamples: 'YouTube 4K streams, Figma master files, active audio tabs',
  },
];

export const MONSTER_BY_TIER: Record<ThreatTier, MonsterBestiarySpec> = {
  1: BESTIARY_MONSTERS[0],
  2: BESTIARY_MONSTERS[1],
  3: BESTIARY_MONSTERS[2],
  4: BESTIARY_MONSTERS[3],
  5: BESTIARY_MONSTERS[4],
};

const SPRITE_FRAMES: Record<MonsterArchetypeId, [string[], string[]]> = {
  'glitch-slime': [
    [
      '................',
      '......PPPP......',
      '....PPPPPPPP....',
      '...PPPWWWWPPP...',
      '..PPPPWPPPPPPP..',
      '..PPPEEPPPPEEP..',
      '..PPPEEPPPPEEP..',
      '.PPPPPPPPPPPPPP.',
      '.PPPPPPPPPPPPPP.',
      '.PPPPPSPPPSPPPP.',
      '.PPPSSSSSSSSPPP.',
      '..SSSSSSSSSSSS..',
      '...SS..SS..SS...',
      '................',
      '................',
      '................',
    ],
    [
      '................',
      '................',
      '.....PPPPPP.....',
      '...PPPPPPPPPP...',
      '..PPPWWWWPPPPP..',
      '.PPPPWPPPPPPPPP.',
      '.PPPPEEPPPPEEPP.',
      '.PPPPEEPPPPEEPP.',
      '.PPPPPPPPPPPPPP.',
      '.PPPPPSPPPSPPPP.',
      '.SSSSSSSSSSSSSS.',
      '..SSS..SS..SSS..',
      '................',
      '................',
      '................',
      '................',
    ],
  ],
  'byte-bat': [
    [
      '................',
      'P..............P',
      'PP...P....P...PP',
      'PPP..PP..PP..PPP',
      'PPPP.PPPPPP.PPPP',
      '.PPPPPPPPPPPPPP.',
      '.PPPPPEPPPEPPPP.',
      '..PPPPEPPPEPPP..',
      '..PPPPWWWWPPPP..',
      '...SSSSSSSSSS...',
      '..S..S.SS.S..S..',
      '.S.....SS.....S.',
      '................',
      '................',
      '................',
      '................',
    ],
    [
      '................',
      '.....P....P.....',
      '.....PP..PP.....',
      '....PPPPPPPP....',
      '...PPPPPPPPPP...',
      '..PPPPEPPPEPPP..',
      '.PPPPPEPPPEPPPP.',
      'PPPPPPWWWWPPPPPP',
      'PPP.SSSSSSSS.PPP',
      'PP...S.SS.S...PP',
      'P......SS......P',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  ],
  'cache-crawler': [
    [
      '................',
      '...P........P...',
      '....P......P....',
      '...PPPPPPPPPP...',
      '..PPPWWWWWWPPP..',
      '.PPPPEEPPPPEEPP.',
      '.PPPPEEPPPPEEPP.',
      '.PPPPPPPPPPPPPP.',
      'SS.PPPPPPPPPP.SS',
      '..S.SSSSSSSS.S..',
      '.S..SSSSSSSS..S.',
      'S..S.S....S.S..S',
      '...S........S...',
      '................',
      '................',
      '................',
    ],
    [
      '................',
      '..P..........P..',
      '...P........P...',
      '...PPPPPPPPPP...',
      '..PPPWWWWWWPPP..',
      '.PPPPEEPPPPEEPP.',
      '.PPPPEEPPPPEEPP.',
      'SS.PPPPPPPPPP.SS',
      '..PPPPPPPPPPPP..',
      '.S..SSSSSSSS..S.',
      'S..S.SSSSSS.S..S',
      '..S...S..S...S..',
      '.....S....S.....',
      '................',
      '................',
      '................',
    ],
  ],
  'ram-reaper': [
    [
      '....PPPPPPPP....',
      '..PPPPWWWWPPPP..',
      '.PPPPWWWWWWPPPP.',
      '.PPPPPPPPPPPPPP.',
      '.PPPEEEPPPEEEPP.',
      '.PPPEEEPPPEEEPP.',
      '.PPPEEEPPPEEEPP.',
      '..PPPP.SS.PPPP..',
      '..PPPP.SS.PPPP..',
      '...SSSSSSSSSS...',
      '...S.S.SS.S.S...',
      '...S.S.SS.S.S...',
      '....SSSSSSSS....',
      '................',
      '................',
      '................',
    ],
    [
      '....PPPPPPPP....',
      '..PPPPWWWWPPPP..',
      '.PPPPWWWWWWPPPP.',
      '.PPPPPPPPPPPPPP.',
      '.PPPEEEPPPEEEPP.',
      '.PPPEWEPPPEWEPP.',
      '.PPPEEEPPPEEEPP.',
      '..PPPP.SS.PPPP..',
      '...SSSSSSSSSS...',
      '...S.S.SS.S.S...',
      '................',
      '...S.S.SS.S.S...',
      '....SSSSSSSS....',
      '................',
      '................',
      '................',
    ],
  ],
  'browser-behemoth': [
    [
      '.P....PPPP....P.',
      '.PP..PPPPPP..PP.',
      '.PPPPPPWWPPPPPP.',
      '..PPPPWWWWPPPP..',
      '.PPPPPPPPPPPPPP.',
      'PPPEEEEPPPPEEEPP',
      'PPPEWEEPPPPEWEPP',
      'PPPEEEEPPPPEEEPP',
      'PPPPPPPPPPPPPPPP',
      '.PPPSSSSSSSSPPP.',
      '.PP.S.S..S.S.PP.',
      'SS..SSSSSSSS..SS',
      'S...PP....PP...S',
      '....SS....SS....',
      '...SS......SS...',
      '................',
    ],
    [
      'P.....PPPP.....P',
      'PP...PPPPPP...PP',
      '.PPPPPPWWPPPPPP.',
      '..PPPPWWWWPPPP..',
      '.PPPPPPPPPPPPPP.',
      'PPPEEEEPPPPEEEPP',
      'PPPEEEEPPPPEEEPP',
      'PPPPPPPPPPPPPPPP',
      '.PPPSSSSSSSSPPP.',
      '.PP.S.S..S.S.PP.',
      '.PP..........PP.',
      'SS..SSSSSSSS..SS',
      'S...PP....PP...S',
      '...SS......SS...',
      '..SS........SS..',
      '................',
    ],
  ],
};

export const PixelMonsterSprite: React.FC<{
  tier: ThreatTier;
  frame: 0 | 1;
  size?: number;
  isHitFlashing?: boolean;
  isHovered?: boolean;
}> = React.memo(({ tier, frame, size = 76, isHitFlashing = false, isHovered = false }) => {
  const spec = MONSTER_BY_TIER[tier];
  const grid = SPRITE_FRAMES[spec.id][frame];

  const getPixelFill = (ch: string): string | null => {
    if (ch === '.') return null;
    if (isHitFlashing) return '#FFFFFF';
    switch (ch) {
      case 'P':
        return spec.primaryColor;
      case 'S':
        return spec.secondaryColor;
      case 'E':
        return isHovered ? '#CA955C' : spec.eyeColor;
      case 'W':
        return '#E9DFCF';
      default:
        return null;
    }
  };

  const rects: React.ReactNode[] = [];
  for (let y = 0; y < 16; y++) {
    const row = grid[y] || '';
    for (let x = 0; x < 16; x++) {
      const fill = getPixelFill(row[x]);
      if (fill) {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
      }
    }
  }

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`pixel-monster-svg ${isHitFlashing ? 'monster-flash' : ''}`}
      aria-label={spec.name}
    >
      {rects}
    </svg>
  );
});

export type WeaponId = 'starter-blaster' | 'double-barrel' | 'plasma-cannon';

export interface WeaponSpec {
  id: WeaponId;
  level: 1 | 2 | 3;
  name: string;
  damage: number;
  cost: number;
  laserColor: string;
  coreColor: string;
  beamWidth: number;
  tagline: string;
}

export const WEAPONS: WeaponSpec[] = [
  {
    id: 'starter-blaster',
    level: 1,
    name: 'Rustbound Relic',
    damage: 1,
    cost: 0,
    laserColor: '#CA955C',
    coreColor: '#FFFFFF',
    beamWidth: 4,
    tagline: 'Standard 1-HP pulse sidearm issued at raid launch.',
  },
  {
    id: 'double-barrel',
    level: 2,
    name: 'Twin Hexcasters',
    damage: 2,
    cost: 600,
    laserColor: '#7BAA9B',
    coreColor: '#CA955C',
    beamWidth: 7,
    tagline: 'Twin-core scatter bolt. Cleaves 2 HP per thumb-trigger shot.',
  },
  {
    id: 'plasma-cannon',
    level: 3,
    name: 'Abyssal Cannon',
    damage: 3,
    cost: 1500,
    laserColor: '#B44653',
    coreColor: '#CA955C',
    beamWidth: 10,
    tagline: 'Overcharged 3-HP plasma rail engineered to melt Browser Behemoths.',
  },
];

const WEAPON_GRIDS: Record<WeaponId, string[]> = {
  'starter-blaster': [
    '................',
    '......PPPPPP....',
    '....PPPPPPPPWWE.',
    '...PPPPPPPPPPPE.',
    '...PPPPSSSSSSSS.',
    '...PPPPSS.......',
    '....PPPSS.......',
    '....PPP.........',
    '....SSS.........',
    '................',
  ],
  'double-barrel': [
    '................',
    '...PPPPPPPPPPWW.',
    '..PPPPPPPPPPPPE.',
    '..SSSSSSSSSSSSE.',
    '..PPPPPPPPPPPPE.',
    '...PPPSSSSSSSS..',
    '...PPPSS........',
    '....PPSS........',
    '....PPP.........',
    '................',
  ],
  'plasma-cannon': [
    '.....WWWW.......',
    '..PPPPPPPPPPPPW.',
    '.PPPPWWWWWWPPPPE',
    '.PPPPEEEEEEPPPPE',
    '.PPPPWWWWWWPPPPE',
    '..PPPPPPPPPPPPW.',
    '...PPPPSSSSSSSS.',
    '....PPPSS..SS...',
    '....PPP....SS...',
    '................',
  ],
};

export const PixelWeaponSprite: React.FC<{ weaponId: WeaponId; size?: number }> = React.memo(
  ({ weaponId, size = 64 }) => {
    const spec = WEAPONS.find((w) => w.id === weaponId) || WEAPONS[0];
    const grid = WEAPON_GRIDS[weaponId];

    const getFill = (ch: string): string | null => {
      switch (ch) {
        case 'P':
          return spec.laserColor;
        case 'S':
          return '#4A3F57';
        case 'W':
          return '#E9DFCF';
        case 'E':
          return spec.coreColor;
        default:
          return null;
      }
    };

    const rects: React.ReactNode[] = [];
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const fill = getFill(row[x]);
        if (fill) {
          rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
        }
      }
    }

    return (
      <svg
        viewBox="0 0 16 10"
        width={size}
        height={Math.round(size * 0.625)}
        shapeRendering="crispEdges"
        className="pixel-weapon-svg"
        aria-label={spec.name}
      >
        {rects}
      </svg>
    );
  }
);

export const BRAND_LOGO_GRID = [
  '..GGGGG.........',
  '.GMMMMMG........',
  'GGGGGGGGGGGGGGGG',
  'GMMMMMMMMMMMMMMG',
  'GMMMMMTTTTMMMMMG',
  'GMMMTTBBBBTTMMMG',
  'GMMTBBBRRBBBTMMG',
  'GMMTBBRMMRBBTMMG',
  'GMMTBBBRRBBBTMMG',
  'GMMMTTBBBBTTMMMG',
  'GMMMMMTTTTMMMMMG',
  'GGGGGGGGGGGGGGGG',
  'GB............BG',
  '.BB..........BB.',
  '..BB........BB..',
  '...BB......BB...',
];

export const LOGO_COLORS: Record<string, string> = {
  G: '#CA955C',
  M: '#211A29',
  T: '#7BAA9B',
  B: '#E9DFCF',
  R: '#B44653',
};

export const PixelBrandLogo: React.FC<{ size?: number }> = React.memo(({ size = 36 }) => {
  const rects: React.ReactNode[] = [];
  BRAND_LOGO_GRID.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = LOGO_COLORS[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    })
  );
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="pixel-brand-logo"
      aria-label="TABWRAITH crest"
    >
      {rects}
    </svg>
  );
});

const CORRUPTED_TAB_GRID = [
  'BBBBBBBBBBBBBBBB',
  'BWWWWBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'B..............B',
  'B..RRRR..RRRR..B',
  'B...RR....RR...B',
  'B...RR....RR...B',
  'B..RRRR..RRRR..B',
  'B..............B',
  'B....RRRRRR....B',
  'B...R.R..R.R...B',
  'B..............B',
  'BBBBBBBBBBBBBBBB',
];

export const PixelCorruptedTabIcon: React.FC<{ size?: number }> = React.memo(({ size = 72 }) => {
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < CORRUPTED_TAB_GRID.length; y++) {
    const row = CORRUPTED_TAB_GRID[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      let fill: string | null = null;
      if (ch === 'B') fill = '#334155';
      else if (ch === 'W') fill = '#CA955C';
      else if (ch === 'R') fill = '#B44653';
      if (fill) {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
      }
    }
  }

  return (
    <svg
      viewBox="0 0 16 13"
      width={size}
      height={Math.round(size * (13 / 16))}
      shapeRendering="crispEdges"
      aria-label="Corrupted Browser Tab"
    >
      {rects}
    </svg>
  );
});
