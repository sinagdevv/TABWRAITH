import React from 'react';

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
    tagline: 'Rune-etched relic. Fires a cursed bolt. 1 HP per shot.',
  },
  {
    id: 'double-barrel',
    level: 2,
    name: 'Twin Hexcasters',
    damage: 2,
    cost: 600,
    laserColor: '#7BAA9B',
    coreColor: '#E9DFCF',
    beamWidth: 7,
    tagline: 'Twin hex bolts, spectral and sharp. 2 HP per shot.',
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
    tagline: 'Abyssal fire from a forbidden cannon. 3 HP per shot.',
  },
];

export const WEAPON_BY_ID: Record<WeaponId, WeaponSpec> = {
  'starter-blaster': WEAPONS[0],
  'double-barrel': WEAPONS[1],
  'plasma-cannon': WEAPONS[2],
};

// 16x10 crisp procedural pixel-art weapon sprites
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
  ({ weaponId, size = 48 }) => {
    const spec = WEAPON_BY_ID[weaponId];
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

/**
 * Original TABWRAITH crest (16x16): cursed browser tab, spectral eye, crossed blades.
 */
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

export const PixelBrandLogo: React.FC<{ size?: number }> = React.memo(({ size = 34 }) => {
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
