// Synthetic-landmark checks for Soul Burst and Wraithblade. Run: node scripts/gesture-test.ts
import assert from 'node:assert/strict';
import { BurstDetector, SwordDetector, classifyPose } from '../src/gestureEngine/combatGestures.ts';

type LM = { x: number; y: number; z: number };
type Fingers = [boolean, boolean, boolean, boolean]; // index, middle, ring, pinky extended

// Builds a 21-point hand: wrist at (0.5, 0.8), fingers pointing up (rotated by `rot` radians).
function hand(f: Fingers, rot = 0, at = { x: 0.5, y: 0.7 }): LM[] {
  const pts: LM[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  const put = (i: number, dx: number, dy: number) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    pts[i] = { x: at.x + dx * c - dy * s, y: at.y + dx * s + dy * c, z: 0 };
  };
  put(0, 0, 0.1);
  [1, 2, 3, 4].forEach((i, k) => put(i, -0.04 - k * 0.025, 0.06 - k * 0.03)); // thumb (ignored)
  const mcpX = [-0.05, -0.017, 0.017, 0.05];
  [5, 9, 13, 17].forEach((base, k) => {
    put(base, mcpX[k], -0.02); // mcp
    if (f[k]) {
      put(base + 1, mcpX[k], -0.07);
      put(base + 2, mcpX[k], -0.11);
      put(base + 3, mcpX[k], -0.15);
    } else {
      // curled: pip up, tip folded back down toward the palm
      put(base + 1, mcpX[k], -0.06);
      put(base + 2, mcpX[k], -0.03);
      put(base + 3, mcpX[k], 0.0);
    }
  });
  return pts;
}
const FIST: Fingers = [false, false, false, false];
const PALM: Fingers = [true, true, true, true];
const SWORD: Fingers = [true, true, false, false];
const GUN: Fingers = [true, false, false, false];

// feeds a pose for durationMs at 30 fps; returns number of triggers
function run(det: { process: (l: LM[] | null, t: number) => any }, clock: { t: number }, lm: LM[] | null, ms: number, key: 'cast' | 'slash') {
  let n = 0;
  for (let e = 0; e < ms; e += 33) {
    clock.t += 33;
    if (det.process(lm, clock.t)[key]) n++;
  }
  return n;
}

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log('PASS', name);
};

t('pose classification is exclusive and thumb-agnostic', () => {
  assert.equal(classifyPose(hand(FIST)), 'fist');
  assert.equal(classifyPose(hand(PALM)), 'palm');
  assert.equal(classifyPose(hand(SWORD)), 'sword');
  assert.equal(classifyPose(hand(GUN)), 'other');
  assert.equal(classifyPose(hand([true, false, true, false])), 'other');
  assert.equal(classifyPose(null), 'none');
});
t('classification survives hand rotation up to 60 degrees', () => {
  for (const deg of [-60, -30, 30, 60]) {
    const r = (deg * Math.PI) / 180;
    assert.equal(classifyPose(hand(FIST, r)), 'fist');
    assert.equal(classifyPose(hand(PALM, r)), 'palm');
    assert.equal(classifyPose(hand(SWORD, r)), 'sword');
  }
});
t('burst: fist then held palm casts exactly once, holding palm never repeats', () => {
  const b = new BurstDetector(), c = { t: 0 };
  assert.equal(run(b, c, hand(FIST), 300, 'cast'), 0);
  assert.equal(b.process(hand(FIST), (c.t += 33)).armed, true);
  assert.equal(run(b, c, hand(PALM), 3000, 'cast'), 1);
});
t('burst: palm without a prior fist never casts', () => {
  const b = new BurstDetector(), c = { t: 0 };
  assert.equal(run(b, c, hand(PALM), 2000, 'cast'), 0);
});
t('burst: brief palm flicker (<240ms) does not cast', () => {
  const b = new BurstDetector(), c = { t: 0 };
  run(b, c, hand(FIST), 300, 'cast');
  assert.equal(run(b, c, hand(PALM), 150, 'cast'), 0);
});
t('burst: needs a new fist to cast again (cooldown + rearm)', () => {
  const b = new BurstDetector(), c = { t: 0 };
  run(b, c, hand(FIST), 300, 'cast');
  assert.equal(run(b, c, hand(PALM), 400, 'cast'), 1);
  assert.equal(run(b, c, hand(PALM), 1000, 'cast'), 0);
  run(b, c, hand(FIST), 700, 'cast');
  assert.equal(run(b, c, hand(PALM), 400, 'cast'), 1);
});
t('burst: losing tracking while armed then returning with palm does not cast', () => {
  const b = new BurstDetector(), c = { t: 0 };
  run(b, c, hand(FIST), 300, 'cast');
  run(b, c, null, 300, 'cast');
  assert.equal(run(b, c, hand(PALM), 1000, 'cast'), 0);
});
t('burst: sword pose or gun pose never casts', () => {
  const b = new BurstDetector(), c = { t: 0 };
  run(b, c, hand(FIST), 300, 'cast');
  assert.equal(run(b, c, hand(SWORD), 1000, 'cast'), 0);
  assert.equal(run(b, c, hand(GUN), 1000, 'cast'), 0);
});
t('sword: held pose slashes exactly once and never repeats while held', () => {
  const s = new SwordDetector(), c = { t: 0 };
  run(s, c, hand(FIST), 200, 'slash');
  assert.equal(run(s, c, hand(SWORD), 4000, 'slash'), 1);
});
t('sword: leaving and re-entering slashes again', () => {
  const s = new SwordDetector(), c = { t: 0 };
  run(s, c, hand(FIST), 200, 'slash');
  assert.equal(run(s, c, hand(SWORD), 800, 'slash'), 1);
  run(s, c, hand(FIST), 200, 'slash');
  assert.equal(run(s, c, hand(SWORD), 1000, 'slash'), 1);
});
t('sword: brief pose (<240ms) does not slash', () => {
  const s = new SwordDetector(), c = { t: 0 };
  run(s, c, hand(FIST), 200, 'slash');
  assert.equal(run(s, c, hand(SWORD), 150, 'slash'), 0);
  assert.equal(run(s, c, hand(FIST), 300, 'slash'), 0);
});
t('sword: pose already held when tracking starts/returns does not slash', () => {
  const s = new SwordDetector(), c = { t: 0 };
  assert.equal(run(s, c, hand(SWORD), 2000, 'slash'), 0);
  run(s, c, hand(FIST), 100, 'slash');
  run(s, c, hand(SWORD), 800, 'slash');
  run(s, c, null, 200, 'slash');
  assert.equal(run(s, c, hand(SWORD), 2000, 'slash'), 0);
});
t('sword: open palm and gun pose never slash', () => {
  const s = new SwordDetector(), c = { t: 0 };
  run(s, c, hand(FIST), 200, 'slash');
  assert.equal(run(s, c, hand(PALM), 1500, 'slash'), 0);
  assert.equal(run(s, c, hand(GUN), 1500, 'slash'), 0);
});
t('sword: works rotated 40 degrees', () => {
  const s = new SwordDetector(), c = { t: 0 };
  const r = (40 * Math.PI) / 180;
  run(s, c, hand(FIST, r), 200, 'slash');
  assert.equal(run(s, c, hand(SWORD, r), 800, 'slash'), 1);
});
console.log(`\n${passed} gesture tests passed (synthetic landmarks; real webcam UNTESTED)`);
