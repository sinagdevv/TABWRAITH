import React from 'react';
import { ThreatTier } from '../tabManager/tabManager';

export type MonsterArchetypeId =
  | 'glitch-slime'
  | 'byte-bat'
  | 'cache-crawler'
  | 'ram-reaper'
  | 'browser-behemoth';

export interface MonsterArchetypeSpec {
  id: MonsterArchetypeId;
  name: string;
  tier: ThreatTier;
  maxHp: number;
  points: number;
  primaryColor: string;
  secondaryColor: string;
  eyeColor: string;
  spriteSizePx: number;
}

export const MONSTER_ARCHETYPES: Record<ThreatTier, MonsterArchetypeSpec> = {
  1: {
    id: 'glitch-slime',
    name: 'Glitch Slime',
    tier: 1,
    maxHp: 1,
    points: 100,
    primaryColor: '#A3E635',
    secondaryColor: '#4D7C0F',
    eyeColor: '#090D16',
    spriteSizePx: 68,
  },
  2: {
    id: 'byte-bat',
    name: 'Byte Bat',
    tier: 2,
    maxHp: 2,
    points: 250,
    primaryColor: '#38BDF8',
    secondaryColor: '#0369A1',
    eyeColor: '#FACC15',
    spriteSizePx: 76,
  },
  3: {
    id: 'cache-crawler',
    name: 'Cache Crawler',
    tier: 3,
    maxHp: 3,
    points: 450,
    primaryColor: '#F59E0B',
    secondaryColor: '#B45309',
    eyeColor: '#EF4444',
    spriteSizePx: 82,
  },
  4: {
    id: 'ram-reaper',
    name: 'RAM Reaper',
    tier: 4,
    maxHp: 4,
    points: 700,
    primaryColor: '#E2E8F0',
    secondaryColor: '#64748B',
    eyeColor: '#FF3B5C',
    spriteSizePx: 90,
  },
  5: {
    id: 'browser-behemoth',
    name: 'Browser Behemoth',
    tier: 5,
    maxHp: 5,
    points: 1000,
    primaryColor: '#FF4D4D',
    secondaryColor: '#991B1B',
    eyeColor: '#CCFF00',
    spriteSizePx: 104,
  },
};

/**
 * 16x16 pixel grids for each monster archetype (2 frames each for crisp idle animation).
 * Legend:
 * '.' = transparent
 * 'P' = primary color
 * 'S' = secondary/shadow color
 * 'E' = eye/core glow color
 * 'W' = white highlight
 */
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

// Slight deterministic color variation seeded by tabId so monsters of the same tier have subtle identity
const ACCENT_PALETTES: Array<{ p: string; s: string }> = [
  { p: '#A3E635', s: '#4D7C0F' },
  { p: '#38BDF8', s: '#0369A1' },
  { p: '#F59E0B', s: '#B45309' },
  { p: '#E2E8F0', s: '#64748B' },
  { p: '#FF4D4D', s: '#991B1B' },
  { p: '#2DD4BF', s: '#0F766E' },
  { p: '#FB923C', s: '#9A3412' },
];

interface PixelMonsterSpriteProps {
  tier: ThreatTier;
  seedId: number;
  frame: 0 | 1;
  isHitFlashing: boolean;
  isLocked: boolean;
}

export const PixelMonsterSprite: React.FC<PixelMonsterSpriteProps> = React.memo(
  ({ tier, seedId, frame, isHitFlashing, isLocked }) => {
    const spec = MONSTER_ARCHETYPES[tier];
    const grid = SPRITE_FRAMES[spec.id][frame];

    // Keep archetype signature color, or subtly shift tint for variety
    const variantIdx = Math.abs(seedId) % ACCENT_PALETTES.length;
    const primary =
      tier === 5 || tier === 4 || variantIdx === tier - 1
        ? spec.primaryColor
        : ACCENT_PALETTES[variantIdx].p;
    const secondary =
      tier === 5 || tier === 4 || variantIdx === tier - 1
        ? spec.secondaryColor
        : ACCENT_PALETTES[variantIdx].s;

    const getPixelFill = (ch: string): string | null => {
      if (ch === '.') return null;
      if (isHitFlashing) return '#FFFFFF';
      switch (ch) {
        case 'P':
          return primary;
        case 'S':
          return secondary;
        case 'E':
          return isLocked ? '#CCFF00' : spec.eyeColor;
        case 'W':
          return '#F8FAFC';
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
          rects.push(
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={fill}
            />
          );
        }
      }
    }

    return (
      <svg
        viewBox="0 0 16 16"
        width={spec.spriteSizePx}
        height={spec.spriteSizePx}
        shapeRendering="crispEdges"
        className={`pixel-monster-svg ${isHitFlashing ? 'monster-svg-flash' : ''}`}
        aria-label={spec.name}
      >
        {rects}
      </svg>
    );
  }
);
