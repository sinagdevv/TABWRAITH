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
    name: 'Ashling',
    tier: 1,
    maxHp: 1,
    points: 100,
    primaryColor: '#7BAA9B',
    secondaryColor: '#3F6359',
    eyeColor: '#B44653',
    spriteSizePx: 68,
  },
  2: {
    id: 'byte-bat',
    name: 'Gloomwing',
    tier: 2,
    maxHp: 2,
    points: 250,
    primaryColor: '#7A6A9B',
    secondaryColor: '#3E3258',
    eyeColor: '#CA955C',
    spriteSizePx: 76,
  },
  3: {
    id: 'cache-crawler',
    name: 'Crypt Crawler',
    tier: 3,
    maxHp: 3,
    points: 450,
    primaryColor: '#B3A27E',
    secondaryColor: '#5E4F38',
    eyeColor: '#B44653',
    spriteSizePx: 82,
  },
  4: {
    id: 'ram-reaper',
    name: 'Soul Reaper',
    tier: 4,
    maxHp: 4,
    points: 700,
    primaryColor: '#E9DFCF',
    secondaryColor: '#8A7F73',
    eyeColor: '#7BAA9B',
    spriteSizePx: 90,
  },
  5: {
    id: 'browser-behemoth',
    name: 'Abyssal Behemoth',
    tier: 5,
    maxHp: 5,
    points: 1000,
    primaryColor: '#B44653',
    secondaryColor: '#5C1F2B',
    eyeColor: '#CA955C',
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
  { p: '#7BAA9B', s: '#3F6359' },
  { p: '#8F7FB0', s: '#3E3258' },
  { p: '#B3A27E', s: '#5E4F38' },
  { p: '#A89B8C', s: '#4A3F57' },
  { p: '#B44653', s: '#5C1F2B' },
  { p: '#6F8F8A', s: '#2F4A47' },
  { p: '#CA955C', s: '#6B4A28' },
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
          return isLocked ? '#CA955C' : spec.eyeColor;
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
