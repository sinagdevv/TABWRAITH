import React from 'react';
import { RELICS, RelicId, Relic, relicRows } from '../handTracking/relics';

const Thumb: React.FC<{ relic: Relic }> = React.memo(({ relic }) => {
  const rows = relicRows(relic);
  return (
    <svg viewBox={`0 0 20 ${rows.length}`} width={34} height={Math.round((34 * rows.length) / 20)} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          relic.palette[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={relic.palette[ch]} /> : null
        )
      )}
    </svg>
  );
});

export type FaceStatus = 'camera-off' | 'searching' | 'tracking' | 'off';

export const RelicSelector: React.FC<{
  value: RelicId | 'off';
  onSelect: (v: RelicId | 'off') => void;
  status: FaceStatus;
}> = ({ value, onSelect, status }) => {
  const active = RELICS.find((r) => r.id === value);
  return (
    <div className="relic-box" style={{ ['--relic-accent' as string]: active?.accent ?? '#4a3f57' }}>
      <div className="relic-head">
        <span className="relic-title">HERO RELICS</span>
        <span className={`relic-status relic-${status}`} data-testid="relic-status" role="status">
          {status === 'off' ? 'OFF' : status === 'camera-off' ? 'ENABLE CAMERA' : status === 'searching' ? 'NO FACE DETECTED' : active?.name}
        </span>
      </div>
      <div className="relic-row" role="radiogroup" aria-label="Hero relic">
        <button
          type="button"
          role="radio"
          aria-checked={value === 'off'}
          className={`relic-btn relic-off ${value === 'off' ? 'relic-active' : ''}`}
          onClick={() => onSelect('off')}
          data-testid="relic-off"
          title="No relic (face tracking stops)"
        >
          OFF
        </button>
        {RELICS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={value === r.id}
            className={`relic-btn ${value === r.id ? 'relic-active' : ''}`}
            style={{ ['--relic-accent' as string]: r.accent }}
            onClick={() => onSelect(r.id)}
            data-testid={`relic-${r.id}`}
            title={`${r.name} (cosmetic only)`}
          >
            <Thumb relic={r} />
          </button>
        ))}
      </div>
    </div>
  );
};
