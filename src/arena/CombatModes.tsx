import React from 'react';

export type CombatMode = 'hexcaster' | 'soulsnap' | 'wraithblade';

export interface CombatModeSpec {
  id: CombatMode;
  name: string;
  hint: string; // short selector tooltip
  guide: Array<[string, string]>; // tracking instructions for this style
  key: string;
}

export const COMBAT_MODES: CombatModeSpec[] = [
  {
    id: 'hexcaster',
    name: 'HEXCASTER',
    hint: 'Point and fire',
    key: '1',
    guide: [
      ['INDEX FINGER', 'AIM CROSSHAIR'],
      ['THUMB UP, THEN FOLD', 'COCK, THEN FIRE'],
    ],
  },
  {
    id: 'soulsnap',
    name: 'SOUL BURST',
    hint: 'Fist, then open palm',
    key: '2',
    guide: [
      ['CLOSE YOUR FIST', 'ARMS THE SPELL'],
      ['OPEN PALM, HOLD', 'CASTS AT YOUR TARGET'],
    ],
  },
  {
    id: 'wraithblade',
    name: 'WRAITHBLADE',
    hint: 'Raise two fingers',
    key: '3',
    guide: [
      ['INDEX + MIDDLE UP', 'HOLD TO SLASH'],
      ['RING + PINKY FOLDED', 'THUMB IGNORED'],
    ],
  },
];

const ICON_GRIDS: Record<CombatMode, string[]> = {
  hexcaster: ['..........', '.BBBBBBB..', 'BGGGGGGBTT', 'BGGBBBBBTW', 'BGGB......', '.BBB......', '.BGB......', '..B.......'],
  soulsnap: ['....V.....', '.V..V..V..', '..V.V.V...', '...VWV....', 'VVVWWWVVV.', '...VWV....', '..V.V.V...', '.V..V..V..'],
  wraithblade: ['.......TT.', '......TWT.', '.....TWT..', '....TWT...', '.B.TWT....', '..GWT.....', '.GG.B.....', 'GB........'],
};
const ICON_COLORS: Record<string, string> = { G: '#CA955C', B: '#6B4A28', T: '#7BAA9B', V: '#9B7BD0', W: '#E9DFCF' };

export const CombatIcon: React.FC<{ mode: CombatMode; size?: number }> = React.memo(({ mode, size = 30 }) => (
  <svg viewBox="0 0 10 8" width={size} height={Math.round(size * 0.8)} shapeRendering="crispEdges" aria-hidden="true">
    {ICON_GRIDS[mode].flatMap((row, y) =>
      [...row].map((ch, x) =>
        ICON_COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ICON_COLORS[ch]} /> : null
      )
    )}
  </svg>
));

export const CombatSelector: React.FC<{ mode: CombatMode; onSelect: (m: CombatMode) => void }> = ({ mode, onSelect }) => (
  <div className="combat-selector" role="radiogroup" aria-label="Combat style">
    {COMBAT_MODES.map((m) => (
      <button
        key={m.id}
        type="button"
        role="radio"
        aria-checked={mode === m.id}
        className={`combat-btn combat-${m.id} ${mode === m.id ? 'combat-active' : ''}`}
        onClick={() => onSelect(m.id)}
        data-testid={`combat-${m.id}`}
        data-tip={`${m.name}: ${m.hint}`}
        title={`${m.name}: ${m.hint} [${m.key}]`}
      >
        <CombatIcon mode={m.id} />
        <span className="combat-name">{m.name}</span>
        <span className="combat-key">{m.key}</span>
      </button>
    ))}
  </div>
);
