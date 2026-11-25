import type { NormalizedLandmark } from './gestureEngine';

// Pose-based combat gestures on the SAME MediaPipe landmarks as finger-gun mode.
// Pose classification uses only 2D wrist-relative distance ratios per finger (no velocity, no Z,
// no wrist-angle thresholds), so it works at any hand rotation. All timing uses frame timestamps
// in ms, so confirmation holds and cooldowns do not depend on tracking FPS.

export interface AimPoint {
  x: number; // 0..1 mirrored, same mapping as the finger-gun crosshair
  y: number;
}

export type HandPose = 'fist' | 'palm' | 'sword' | 'other' | 'none';

const dist = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y);
const mapAxis = (v: number) => Math.min(1, Math.max(0, (v - 0.1) / 0.8));
const toAim = (x: number, y: number): AimPoint => ({ x: mapAxis(1 - x), y: mapAxis(y) });

type FingerState = 'extended' | 'curled' | 'unsure';

// tip distance from wrist divided by pip distance from wrist: ~1.3-1.6 extended, <1.0 curled.
// The gap between the two thresholds is the hysteresis band (reported as 'unsure').
const EXT_RATIO = 1.18;
const CURL_RATIO = 1.0;
const MIN_PALM = 0.04; // hand too small/far: reject

function fingerState(lm: NormalizedLandmark[], pip: number, tip: number): FingerState {
  const r = dist(lm[0], lm[tip]) / Math.max(1e-4, dist(lm[0], lm[pip]));
  return r >= EXT_RATIO ? 'extended' : r <= CURL_RATIO ? 'curled' : 'unsure';
}

/** Mutually exclusive coarse pose. Thumb is ignored. */
export function classifyPose(lm: NormalizedLandmark[] | null | undefined): HandPose {
  if (!lm || lm.length < 21 || dist(lm[0], lm[9]) < MIN_PALM) return 'none';
  const idx = fingerState(lm, 6, 8);
  const mid = fingerState(lm, 10, 12);
  const ring = fingerState(lm, 14, 16);
  const pinky = fingerState(lm, 18, 20);
  if (idx === 'curled' && mid === 'curled' && ring === 'curled' && pinky === 'curled') return 'fist';
  if (idx === 'extended' && mid === 'extended' && ring === 'extended' && pinky === 'extended') return 'palm';
  if (idx === 'extended' && mid === 'extended' && ring === 'curled' && pinky === 'curled') return 'sword';
  return 'other';
}

const palmCenter = (lm: NormalizedLandmark[]): AimPoint => {
  const ids = [0, 5, 9, 13, 17];
  return toAim(ids.reduce((s, i) => s + lm[i].x, 0) / ids.length, ids.reduce((s, i) => s + lm[i].y, 0) / ids.length);
};

export interface BurstResult {
  aim: AimPoint | null;
  pose: HandPose;
  armed: boolean; // fist confirmed: spell armed
  cast: AimPoint | null; // set for exactly one frame per cast
}

/** SOUL BURST: confirmed fist arms the spell, a held open palm casts it once. */
export class BurstDetector {
  static readonly FIST_HOLD_MS = 120;
  static readonly PALM_HOLD_MS = 240;
  static readonly COOLDOWN_MS = 500;
  private fistSince = 0;
  private palmSince = 0;
  private armed = false;
  private lastCast = -1e9;

  reset(): void {
    this.fistSince = 0;
    this.palmSince = 0;
    this.armed = false;
  }

  process(lm: NormalizedLandmark[] | null | undefined, now: number): BurstResult {
    const pose = classifyPose(lm);
    if (pose === 'none' || !lm) {
      this.reset(); // tracking lost: never cast on return, a fresh fist is required
      return { aim: null, pose, armed: false, cast: null };
    }
    const aim = palmCenter(lm);
    let cast: AimPoint | null = null;

    if (pose === 'fist') {
      this.palmSince = 0;
      if (!this.fistSince) this.fistSince = now;
      if (!this.armed && now - this.fistSince >= BurstDetector.FIST_HOLD_MS && now - this.lastCast > BurstDetector.COOLDOWN_MS) {
        this.armed = true;
      }
    } else if (pose === 'palm') {
      this.fistSince = 0;
      if (this.armed) {
        if (!this.palmSince) this.palmSince = now;
        if (now - this.palmSince >= BurstDetector.PALM_HOLD_MS) {
          cast = aim;
          this.armed = false; // must make a fist again before the next cast
          this.palmSince = 0;
          this.lastCast = now;
        }
      }
    } else {
      // opening/transition frames keep the spell armed; they just restart the confirmations
      this.fistSince = 0;
      this.palmSince = 0;
    }
    return { aim, pose, armed: this.armed, cast };
  }
}

export interface SwordResult {
  aim: AimPoint | null;
  pose: HandPose;
  slash: AimPoint | null; // set for exactly one frame per slash
}

/** WRAITHBLADE: index+middle raised (ring/pinky folded) held briefly slashes once. */
export class SwordDetector {
  static readonly HOLD_MS = 240;
  static readonly COOLDOWN_MS = 600;
  private since = 0;
  private sawOther = false; // must have been OUT of the pose since (re)start
  private spent = false; // slash fired for this hold: leave the pose to re-arm
  private lastSlash = -1e9;

  reset(): void {
    this.since = 0;
    this.sawOther = false;
    this.spent = false;
  }

  process(lm: NormalizedLandmark[] | null | undefined, now: number): SwordResult {
    const pose = classifyPose(lm);
    if (pose === 'none' || !lm) {
      this.reset(); // tracking lost: returning straight into the pose does not attack
      return { aim: null, pose, slash: null };
    }
    const aim = toAim((lm[8].x + lm[12].x) / 2, (lm[8].y + lm[12].y) / 2);
    let slash: AimPoint | null = null;

    if (pose === 'sword') {
      if (this.sawOther && !this.spent) {
        if (!this.since) this.since = now;
        if (now - this.since >= SwordDetector.HOLD_MS && now - this.lastSlash > SwordDetector.COOLDOWN_MS) {
          slash = aim;
          this.spent = true;
          this.lastSlash = now;
        }
      }
    } else {
      this.since = 0;
      this.spent = false;
      this.sawOther = true;
    }
    return { aim, pose, slash };
  }
}
