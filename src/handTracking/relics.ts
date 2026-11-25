// Original dark fantasy pixel relics. Each row is the LEFT half (10 cells); the right half is mirrored.
// '.' is transparent. eyeRow is the sprite row that should sit on the midpoint between the eyes.

export type RelicId = 'wraith-crown' | 'crimson-knight' | 'ashen-hunter' | 'sunfall-paladin' | 'void-sorcerer';

export interface Relic {
  id: RelicId;
  name: string;
  accent: string; // rune colour for UI
  eyeRow: number;
  half: string[];
  palette: Record<string, string>;
  notes: number[]; // short switch chime
}

export const RELICS: Relic[] = [
  {
    id: 'wraith-crown',
    name: 'WRAITH CROWN',
    accent: '#7BAA9B',
    eyeRow: 8.5,
    notes: [392, 466.16, 587.33],
    palette: { o: '#2a2230', b: '#CFC6B4', t: '#7BAA9B', w: '#FFFFFF' },
    half: ['t.........', 'tt......b.', 'ttb..b.bbb', 'tbb.bbbbbb', 'obbbbbbbbb', 'obtbbwwbtb', 'oooooooooo', '..........', '.....t....'],
  },
  {
    id: 'crimson-knight',
    name: 'CRIMSON KNIGHT',
    accent: '#B44653',
    eyeRow: 6,
    notes: [220, 330, 440],
    palette: { o: '#1b1722', s: '#8A8498', d: '#4A4558', w: '#CFCBD8', r: '#B44653' },
    half: ['...ooooooo', '..osssssss', '.osssswsss', 'osssssssss', 'oddddddddd', 'odrrrrrrrr', 'odrrwrrrrr', 'oddddddddd', 'osdsssssss', 'oosssssssd'],
  },
  {
    id: 'ashen-hunter',
    name: 'ASHEN HUNTER',
    accent: '#A89B8C',
    eyeRow: 6.5,
    notes: [330, 294, 247],
    palette: { h: '#3B3046', k: '#150F1B', a: '#6E6478', e: '#CA955C' },
    half: ['...hhhhhhh', '..hhhhhhhh', '.hhhhhhhhh', 'hhhhhaaaaa', 'hhhkkkkkkk', 'hhkkkkkkkk', 'hhkkeekkkk', 'hhkkkkkkkk', 'hhhkkkkkkk', 'hhhhhkkkkk'],
  },
  {
    id: 'sunfall-paladin',
    name: 'SUNFALL PALADIN',
    accent: '#CA955C',
    eyeRow: 5.8,
    notes: [392, 523.25, 659.25],
    palette: { o: '#3A2A14', g: '#CA955C', G: '#8A6A3C', y: '#E5C58F' },
    half: ['....oooooo', '..ooyyyyyy', '.oyyggggyg', 'oyggggGggg', 'oggggggggg', 'ogg.......', 'ogg......G', 'oggggggggg', 'oyggggGggg', 'ooyggggggg'],
  },
  {
    id: 'void-sorcerer',
    name: 'VOID SORCERER',
    accent: '#9B7BD0',
    eyeRow: 5.8,
    notes: [261.63, 392, 311.13, 466.16],
    palette: { o: '#1a1226', k: '#2a1d3d', p: '#6B4AA0', v: '#9B7BD0', w: '#E9DFCF' },
    half: ['..v.....v.', '.v.....w..', '...ooooooo', '..ookkkkkk', '.ookkkkkkk', 'ookk...ppp', 'okkp....pp', 'okpppvpppp', 'ookppppppp', '..ooppkkkk'],
  },
];

export const RELIC_BY_ID: Record<RelicId, Relic> = Object.fromEntries(RELICS.map((r) => [r.id, r])) as Record<RelicId, Relic>;

export const SPRITE_W = 20;

/** Expanded 20-wide rows. */
export function relicRows(r: Relic): string[] {
  return r.half.map((h) => h.padEnd(10, '.').slice(0, 10) + [...h.padEnd(10, '.').slice(0, 10)].reverse().join(''));
}

const spriteCache = new Map<RelicId, HTMLCanvasElement>();

/** 20xN offscreen sprite, drawn once and scaled with nearest-neighbour. */
export function relicSprite(r: Relic): HTMLCanvasElement {
  let c = spriteCache.get(r.id);
  if (c) return c;
  const rows = relicRows(r);
  c = document.createElement('canvas');
  c.width = SPRITE_W;
  c.height = rows.length;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = r.palette[ch];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    })
  );
  spriteCache.set(r.id, c);
  return c;
}
