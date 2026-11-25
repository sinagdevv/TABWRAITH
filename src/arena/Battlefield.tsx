import React from 'react';

// [x, y, w, h] pixel rects on a 160x48 grid, bottom-aligned. Original ruined-castle silhouettes.
const FAR: number[][] = [
  [4, 30, 10, 18], [3, 28, 3, 2], [8, 28, 3, 2], [12, 28, 3, 2], [40, 24, 8, 24], [39, 22, 3, 2], [44, 22, 3, 2],
  [48, 34, 22, 14], [70, 20, 9, 28], [69, 18, 3, 2], [73, 18, 3, 2], [77, 18, 3, 2], [79, 32, 18, 16],
  [97, 26, 7, 22], [96, 24, 3, 2], [101, 24, 3, 2], [118, 28, 12, 20], [117, 26, 3, 2], [122, 26, 3, 2],
  [127, 26, 3, 2], [140, 34, 20, 14],
];
const NEAR: number[][] = [
  [0, 40, 22, 8], [18, 34, 6, 14], [30, 38, 14, 10], [56, 41, 24, 7], [60, 36, 4, 5], [104, 39, 16, 9],
  [112, 31, 5, 8], [128, 40, 32, 8], [144, 35, 4, 5],
];
const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 8) % 96}%`,
  delay: `${(i * 1.7) % 9}s`,
  dur: `${7 + ((i * 5) % 6)}s`,
}));

export const Battlefield: React.FC = React.memo(() => (
  <div className="battlefield" aria-hidden="true">
    <div className="bf-moon" />
    <svg className="bf-castle bf-far" viewBox="0 0 160 48" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges">
      {FAR.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} />
      ))}
      {[[73, 26], [101, 32], [44, 30], [122, 34]].map(([x, y], i) => (
        <rect key={`w${i}`} x={x} y={y} width={2} height={3} className="bf-window" />
      ))}
    </svg>
    <svg className="bf-castle bf-near" viewBox="0 0 160 48" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges">
      {NEAR.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} />
      ))}
    </svg>
    <div className="bf-fog bf-fog-a" />
    <div className="bf-fog bf-fog-b" />
    <div className="bf-ground" />
    <div className="bf-runes">ᚦ ᚨ ᛒ ᚱ ᛉ ᛟ ᚲ ᛞ</div>
    {EMBERS.map((e, i) => (
      <span key={i} className="bf-ember" style={{ left: e.left, animationDelay: e.delay, animationDuration: e.dur }} />
    ))}
  </div>
));
