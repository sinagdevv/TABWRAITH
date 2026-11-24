export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export type ActionableGestureState =
  | 'NO HAND'
  | 'POSE NOT RECOGNIZED'
  | 'READY'
  | 'FIST DETECTED'
  | 'SPELL ARMED'
  | 'SWORD READY'
  | 'FIRED';

export interface GestureFrameResult {
  handDetected: boolean;
  isFingerGunPose: boolean;
  thumbCocked: boolean;
  thumbFiredThisFrame: boolean;
  cooldownProgress: number;
  crosshairX: number; // 0..1 screen space (mirrored)
  crosshairY: number; // 0..1 screen space
  statusLabel: ActionableGestureState;
  detailHint: string;
  poseConfidence: number;
  // Aim ~140ms before the trigger: folding the thumb nudges the index fingertip, so shots use this
  fireAimX?: number;
  fireAimY?: number;
  // raw trigger numbers for ?debug diagnostics
  thumbClearance?: number;
  thumbExtension?: number;
}

const FIRE_COOLDOWN_MS = 420;
const FIRED_BADGE_HOLD_MS = 220;

function distance2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distance3D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.45);
}

export class GestureEngine {
  private smoothedX = 0.5;
  private smoothedY = 0.5;
  private hasInitializedAim = false;
  private lastFireTimestamp = 0;
  private wasThumbCocked = false;
  private poseHoldFrames = 0;
  private cockedFrames = 0;
  private foldedFrames = 0;
  private aimHist: Array<{ t: number; x: number; y: number }> = [];
  private lastGunPoseMs = -1e9;
  // counters for ?debug: they tell cocking problems (folds with no cock) from firing problems
  public stats = { cocks: 0, fires: 0, foldsWithoutCock: 0, poseDrops: 0 };

  // Base alpha tuned for crisp 1€-filter-inspired velocity response
  private readonly baseAlpha = 0.42;

  public reset(): void {
    this.hasInitializedAim = false;
    this.wasThumbCocked = false;
    this.poseHoldFrames = 0;
    this.cockedFrames = 0;
    this.foldedFrames = 0;
    this.aimHist = [];
    this.lastGunPoseMs = -1e9;
  }

  private aimAt(t: number): { x: number; y: number } {
    let pick = this.aimHist[0];
    for (const s of this.aimHist) if (s.t <= t) pick = s;
    return pick ? { x: pick.x, y: pick.y } : { x: this.smoothedX, y: this.smoothedY };
  }

  public processLandmarks(
    landmarks: NormalizedLandmark[] | null | undefined,
    nowMs: number = performance.now()
  ): GestureFrameResult {
    const timeSinceFire = nowMs - this.lastFireTimestamp;
    const cooldownRemaining = Math.max(0, FIRE_COOLDOWN_MS - timeSinceFire);
    const cooldownProgress = cooldownRemaining / FIRE_COOLDOWN_MS;

    if (!landmarks || landmarks.length < 21) {
      this.poseHoldFrames = 0;
      this.foldedFrames = 0;
      // tracking lost: a stale cock must not fire when the hand comes back (short blips are tolerated)
      if (nowMs - this.lastGunPoseMs > 300) {
        if (this.wasThumbCocked) this.stats.poseDrops++;
        this.wasThumbCocked = false;
        this.cockedFrames = 0;
      }
      return {
        handDetected: false,
        isFingerGunPose: false,
        thumbCocked: false,
        thumbFiredThisFrame: false,
        cooldownProgress,
        crosshairX: this.smoothedX,
        crosshairY: this.smoothedY,
        statusLabel: 'NO HAND',
        detailHint: 'RAISE HAND IN VIEW OF CAMERA',
        poseConfidence: 0,
      };
    }

    const wrist = landmarks[0];
    const thumbCmc = landmarks[1];
    const thumbMcp = landmarks[2];
    const thumbIp = landmarks[3];
    const thumbTip = landmarks[4];

    const indexMcp = landmarks[5];
    const indexPip = landmarks[6];
    const indexDip = landmarks[7];
    const indexTip = landmarks[8];

    const middleMcp = landmarks[9];
    const middlePip = landmarks[10];
    const middleTip = landmarks[12];

    const ringMcp = landmarks[13];
    const ringPip = landmarks[14];
    const ringTip = landmarks[16];

    const pinkyMcp = landmarks[17];
    const pinkyPip = landmarks[18];
    const pinkyTip = landmarks[20];

    const palmScale = Math.max(0.045, distance2D(wrist, indexMcp));

    // 1. Low-latency mirrored aiming from index fingertip (landmark 8)
    // Active region [0.10..0.90] mapped to [0..1] for effortless edge targeting
    const rawMirroredX = 1 - indexTip.x;
    const rawY = indexTip.y;
    const mappedX = Math.min(1, Math.max(0, (rawMirroredX - 0.1) / 0.8));
    const mappedY = Math.min(1, Math.max(0, (rawY - 0.1) / 0.8));

    if (!this.hasInitializedAim) {
      this.smoothedX = mappedX;
      this.smoothedY = mappedY;
      this.hasInitializedAim = true;
    } else {
      // Velocity-adaptive smoothing: dead-steady when holding still, near-instant when sweeping
      const delta = Math.hypot(mappedX - this.smoothedX, mappedY - this.smoothedY);
      const dynamicAlpha = Math.min(0.86, Math.max(0.28, this.baseAlpha + delta * 3.2));
      this.smoothedX += (mappedX - this.smoothedX) * dynamicAlpha;
      this.smoothedY += (mappedY - this.smoothedY) * dynamicAlpha;
    }

    this.aimHist.push({ t: nowMs, x: this.smoothedX, y: this.smoothedY });
    while (this.aimHist.length > 1 && nowMs - this.aimHist[0].t > 700) this.aimHist.shift();

    // 2. Orientation-agnostic index finger extension check
    const indexTipDist = distance3D(wrist, indexTip);
    const indexPipDist = distance3D(wrist, indexPip);
    const indexMcpDist = distance3D(wrist, indexMcp);
    const indexBoneSum =
      distance2D(indexMcp, indexPip) +
      distance2D(indexPip, indexDip) +
      distance2D(indexDip, indexTip) +
      1e-4;
    const indexStraightness = distance2D(indexMcp, indexTip) / indexBoneSum;

    const isIndexExtended =
      indexTipDist > indexPipDist * 1.04 &&
      indexTipDist > indexMcpDist * 1.15 &&
      indexStraightness > 0.66;

    // 3. Other fingers curled check (orientation-independent distance ratios)
    const isFingerCurled = (
      tip: NormalizedLandmark,
      pip: NormalizedLandmark,
      mcp: NormalizedLandmark
    ) => {
      const tipToWrist = distance3D(wrist, tip);
      const pipToWrist = distance3D(wrist, pip);
      const tipToMcpNorm = distance3D(mcp, tip) / palmScale;
      return tipToWrist < pipToWrist * 1.16 || tipToMcpNorm < 0.88;
    };

    const middleCurled = isFingerCurled(middleTip, middlePip, middleMcp);
    const ringCurled = isFingerCurled(ringTip, ringPip, ringMcp);
    const pinkyCurled = isFingerCurled(pinkyTip, pinkyPip, pinkyMcp);

    const curledCount = (middleCurled ? 1 : 0) + (ringCurled ? 1 : 0) + (pinkyCurled ? 1 : 0);
    const rawFingerGunCandidate = isIndexExtended && curledCount >= 2;

    // Short hysteresis so single-frame MediaPipe dropouts don't break lock
    if (rawFingerGunCandidate) {
      this.poseHoldFrames = Math.min(6, this.poseHoldFrames + 2);
    } else {
      this.poseHoldFrames = Math.max(0, this.poseHoldFrames - 1);
    }
    const isFingerGunPose = this.poseHoldFrames >= 2;

    // 4. Thumb cocked vs folded trigger transition
    const thumbToIndexMcp = distance3D(thumbTip, indexMcp) / palmScale;
    const thumbToIndexPip = distance3D(thumbTip, indexPip) / palmScale;
    const thumbToMiddlePip = distance3D(thumbTip, middlePip) / palmScale;
    const thumbBoneSum =
      distance2D(thumbCmc, thumbMcp) + distance2D(thumbMcp, thumbIp) + 1e-4;
    const thumbExtension = distance2D(thumbCmc, thumbTip) / thumbBoneSum;

    const thumbClearance = Math.min(
      thumbToIndexMcp,
      thumbToIndexPip,
      thumbToMiddlePip * 0.95
    );

    // Hysteresis gap between cocked (>0.50) and folded (<0.44)
    const isThumbRaisedRaw = thumbClearance > 0.5 && thumbExtension > 0.68;
    const isThumbFoldedRaw =
      thumbClearance < 0.44 || thumbTip.y > indexMcp.y + palmScale * 0.1;

    // A thumb fold can briefly disturb the other landmarks and drop the pose for a few frames.
    // Keep the trigger context alive for 250ms so that dropout cannot swallow the shot.
    if (isFingerGunPose) this.lastGunPoseMs = nowMs;
    const gunContext = isFingerGunPose || nowMs - this.lastGunPoseMs <= 250;

    if (gunContext) {
      if (isThumbRaisedRaw) {
        this.cockedFrames++;
        this.foldedFrames = 0;
        if (!this.wasThumbCocked) this.stats.cocks++;
        this.wasThumbCocked = true;
      } else if (isThumbFoldedRaw) {
        if (this.foldedFrames === 0 && !this.wasThumbCocked && isFingerGunPose) this.stats.foldsWithoutCock++;
        this.foldedFrames++;
        this.cockedFrames = 0;
      }
    } else {
      if (this.wasThumbCocked) this.stats.poseDrops++;
      this.cockedFrames = 0;
      this.foldedFrames = 0;
      this.wasThumbCocked = false;
    }

    let thumbFiredThisFrame = false;
    let fireAim: { x: number; y: number } | null = null;
    if (
      gunContext &&
      this.wasThumbCocked &&
      this.foldedFrames >= 1 &&
      cooldownRemaining <= 0
    ) {
      thumbFiredThisFrame = true;
      this.stats.fires++;
      fireAim = this.aimAt(nowMs - 140);
      this.lastFireTimestamp = nowMs;
      this.wasThumbCocked = false;
      this.foldedFrames = 0;
    }

    // Actionable status state machine
    let statusLabel: ActionableGestureState = 'POSE NOT RECOGNIZED';
    let detailHint = 'EXTEND INDEX FINGER & CURL OTHER FINGERS';

    if (thumbFiredThisFrame || timeSinceFire < FIRED_BADGE_HOLD_MS) {
      statusLabel = 'FIRED';
      detailHint = 'SHOT DISPATCHED · RAISE THUMB TO RE-COCK';
    } else if (isFingerGunPose) {
      statusLabel = 'READY';
      detailHint = this.wasThumbCocked
        ? 'LOCKED · FOLD THUMB DOWN TO FIRE'
        : 'AIMING · RAISE THUMB TO COCK TRIGGER';
    }

    const poseConfidence = isFingerGunPose
      ? Math.min(1, 0.68 + (curledCount / 3) * 0.32)
      : isIndexExtended
      ? 0.4
      : 0.15;

    return {
      handDetected: true,
      isFingerGunPose,
      thumbCocked: this.wasThumbCocked,
      thumbFiredThisFrame,
      cooldownProgress,
      crosshairX: this.smoothedX,
      crosshairY: this.smoothedY,
      statusLabel,
      detailHint,
      poseConfidence,
      fireAimX: fireAim?.x,
      fireAimY: fireAim?.y,
      thumbClearance,
      thumbExtension,
    };
  }
}
