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
    name: 'Starter Blaster',
    damage: 1,
    cost: 0,
    laserColor: '#CCFF00',
    coreColor: '#FFFFFF',
    beamWidth: 4,
    tagline: 'Standard 1-HP pulse sidearm.',
  },
  {
    id: 'double-barrel',
    level: 2,
    name: 'Double Barrel',
    damage: 2,
    cost: 600,
    laserColor: '#2DD4BF',
    coreColor: '#CCFF00',
    beamWidth: 7,
    tagline: 'Twin-core scatter bolt. 2 HP per shot.',
  },
  {
    id: 'plasma-cannon',
    level: 3,
    name: 'Plasma Cannon',
    damage: 3,
    cost: 1500,
    laserColor: '#FF5500',
    coreColor: '#FACC15',
    beamWidth: 10,
    tagline: 'Heavy overcharged plasma rail. 3 HP per shot.',
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
          return '#475569';
        case 'W':
          return '#F8FAFC';
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
 * Original Pixel-Art TAB RAID Brand Mark (16x16 grid):
 * Combines a dark monster silhouette with an acid-lime arcade crosshair.
 */
const BRAND_LOGO_GRID = [
  '.......LL.......',
  '.......LL.......',
  '..MM..MMMM..MM..',
  '..MMMMMMMMMMMM..',
  '.MMMMLLLLLLMMMM.',
  '.MMMLLMMMMLLMMM.',
  '.MMMLMRMMRMLLMM.',
  'LLLLLMMMMMMLLLLL',
  'LLLLLMMMMMMLLLLL',
  '.MMMLMMMMMMLLMM.',
  '.MMMLLMMMMLLMMM.',
  '.MMMMLLLLLLMMMM.',
  '..MMM.M..M.MMM..',
  '..MM........MM..',
  '.......LL.......',
  '.......LL.......',
];

export const PixelBrandLogo: React.FC<{ size?: number }> = React.memo(({ size = 34 }) => {
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < 16; y++) {
    const row = BRAND_LOGO_GRID[y];
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      let fill: string | null = null;
      if (ch === 'L') fill = '#CCFF00';
      else if (ch === 'M') fill = '#1E293B';
      else if (ch === 'R') fill = '#FF3B5C';
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
      className="pixel-brand-logo"
      aria-label="TAB RAID Logo"
    >
      <rect x={0} y={0} width={16} height={16} fill="#0A0C10" />
      <rect x={0} y={0} width={16} height={1} fill="#CCFF00" />
      <rect x={0} y={15} width={16} height={1} fill="#CCFF00" />
      <rect x={0} y={0} width={1} height={16} fill="#CCFF00" />
      <rect x={15} y={0} width={1} height={16} fill="#CCFF00" />
      {rects}
    </svg>
  );
});
