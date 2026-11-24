import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { RELIC_BY_ID, RelicId, Relic, SPRITE_W, relicSprite } from './relics';

// Separate, lower-frequency face pipeline that reuses the SAME <video> as hand tracking.
// It never touches the hand pipeline, never queues overlapping inferences, and is fully
// stopped when relics are OFF. Frames are never stored, recorded or sent anywhere.

let detectorPromise: Promise<FaceDetector> | null = null;

function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const baseUrl = new URL('./mediapipe', window.location.href).href;
      const vision = await FilesetResolver.forVisionTasks(`${baseUrl}/wasm`);
      return FaceDetector.createFromOptions(vision, {
        // CPU keeps the GPU free for the hand landmarker
        baseOptions: { modelAssetPath: `${baseUrl}/blaze_face_short_range.tflite`, delegate: 'CPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.6,
      });
    })();
    detectorPromise.catch(() => {
      detectorPromise = null;
    });
  }
  return detectorPromise;
}

interface Pose {
  cx: number; // normalized, mirrored
  cy: number;
  w: number; // face width, normalized
  ang: number; // radians
}

export interface FaceStats {
  fps: number;
  ms: number;
  intervalMs: number;
}

export class FaceRelicController {
  intervalMs = 100; // starts at ~10 FPS, adapts between 100 and 300 ms
  latencyMs = 0;
  fps = 0;
  visible = false;
  onAutoDisable?: () => void;
  running = false;

  private relic: Relic | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private busy = false;
  private timer = 0;
  private raf = 0;
  private lastVideoTime = -1;
  private lastTs = -1;
  private target: (Pose & { seen: number }) | null = null;
  private cur: Pose | null = null;
  private popAt = 0;
  private frames = 0;
  private lastStatT = 0;
  private lastDraw = 0;
  private cleared = true;
  private baseline = 0.9; // hand tracking fps / camera fps measured while relics were off
  private bad = 0;
  private good = 0;
  private maxedOut = 0;

  start(video: HTMLVideoElement, canvas: HTMLCanvasElement, id: RelicId): void {
    this.video = video;
    this.canvas = canvas;
    this.setRelic(id);
    if (this.running) return;
    this.running = true;
    this.frames = 0;
    this.lastStatT = performance.now();
    this.timer = window.setTimeout(this.detect, 0);
    this.raf = requestAnimationFrame(this.draw);
  }

  setRelic(id: RelicId): void {
    this.relic = RELIC_BY_ID[id];
    this.popAt = performance.now();
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
    this.target = null;
    this.cur = null;
    this.visible = false;
    this.clear();
  }

  stats(): FaceStats | null {
    return this.running ? { fps: this.fps, ms: Math.round(this.latencyMs * 10) / 10, intervalMs: this.intervalMs } : null;
  }

  /** Called ~2.5x/s with hand-pipeline numbers; slows or stops face tracking if hand tracking suffers. */
  report(camFps: number, trackFps: number): void {
    if (camFps <= 0) return;
    const ratio = trackFps / camFps;
    if (!this.running) {
      if (camFps > 10) this.baseline = this.baseline * 0.7 + ratio * 0.3;
      return;
    }
    const now = performance.now();
    this.fps = Math.round((this.frames * 1000) / Math.max(1, now - this.lastStatT));
    this.frames = 0;
    this.lastStatT = now;

    const slow = ratio < this.baseline * 0.8 || this.latencyMs > 30;
    if (slow) {
      this.good = 0;
      if (++this.bad >= 2) {
        this.bad = 0;
        if (this.intervalMs >= 300) {
          if (++this.maxedOut >= 3) this.onAutoDisable?.();
        } else {
          this.intervalMs = Math.min(300, Math.round(this.intervalMs * 1.5));
        }
      }
    } else {
      this.bad = 0;
      this.maxedOut = 0;
      if (++this.good >= 6 && this.intervalMs > 100) {
        this.intervalMs = Math.max(100, Math.round(this.intervalMs / 1.25));
        this.good = 0;
      }
    }
  }

  private detect = async () => {
    if (!this.running) return;
    const v = this.video;
    if (v && v.readyState >= 2 && v.currentTime !== this.lastVideoTime && !this.busy) {
      this.busy = true; // never overlap face inferences
      try {
        const det = await getDetector();
        if (this.running) {
          this.lastVideoTime = v.currentTime;
          const t0 = performance.now();
          this.lastTs = Math.max(this.lastTs + 1, Math.floor(t0));
          const res = det.detectForVideo(v, this.lastTs);
          const ms = performance.now() - t0;
          this.latencyMs = this.latencyMs ? this.latencyMs * 0.8 + ms * 0.2 : ms;
          this.frames++;
          this.ingest(res.detections?.[0], v);
        }
      } catch {
        // skip this frame; tracking resumes on the next one
      } finally {
        this.busy = false;
      }
    }
    if (this.running) this.timer = window.setTimeout(this.detect, this.intervalMs);
  };

  private ingest(d: { boundingBox?: { width: number }; keypoints?: Array<{ x: number; y: number }> } | undefined, v: HTMLVideoElement): void {
    const kp = d?.keypoints;
    if (!d || !d.boundingBox || !kp || kp.length < 2) return;
    const vw = v.videoWidth || 480;
    const vh = v.videoHeight || 360;
    // mirror x so the overlay matches the mirrored preview; left eye first
    const [a, b] = [kp[0], kp[1]].map((k) => ({ x: 1 - k.x, y: k.y })).sort((p, q) => p.x - q.x);
    this.target = {
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      w: d.boundingBox.width / vw,
      ang: Math.atan2((b.y - a.y) * vh, (b.x - a.x) * vw),
      seen: performance.now(),
    };
    if (!this.cur) this.cur = { cx: this.target.cx, cy: this.target.cy, w: this.target.w, ang: this.target.ang };
  }

  private clear(): void {
    if (this.cleared || !this.canvas) return;
    this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.cleared = true;
  }

  // Cheap 30 Hz render loop: interpolates the cached face pose between detections.
  private draw = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.draw);
    if (now - this.lastDraw < 30) return;
    const dt = Math.min(0.1, (now - this.lastDraw) / 1000);
    this.lastDraw = now;
    const c = this.canvas;
    const t = this.target;
    const relic = this.relic;
    if (!c || !relic) return;
    const age = t ? now - t.seen : Infinity;
    if (!t || !this.cur || age > 600) {
      this.visible = false;
      this.clear();
      return;
    }
    this.visible = true;
    const k = 1 - Math.exp(-dt * 16);
    const cur = this.cur;
    cur.cx += (t.cx - cur.cx) * k;
    cur.cy += (t.cy - cur.cy) * k;
    cur.w += (t.w - cur.w) * k;
    cur.ang += (t.ang - cur.ang) * k;

    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);
    this.cleared = false;
    const sprite = relicSprite(relic);
    const cell = Math.max(2, Math.round((cur.w * W * 1.25) / SPRITE_W));
    const pop = Math.min(1, (now - this.popAt) / 220);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(Math.round(cur.cx * W), Math.round(cur.cy * H));
    ctx.rotate(cur.ang);
    ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
    ctx.globalAlpha = age < 350 ? 0.95 : 0.95 * (1 - (age - 350) / 250);
    ctx.drawImage(sprite, -(SPRITE_W / 2) * cell, -relic.eyeRow * cell, SPRITE_W * cell, sprite.height * cell);
    ctx.restore();

    // tiny pixel sparks right after switching relics
    const sp = (now - this.popAt) / 450;
    if (sp < 1) {
      ctx.fillStyle = relic.accent;
      for (let i = 0; i < 10; i++) {
        const ang = i * 0.628;
        const r = sp * cell * 9;
        ctx.fillRect(Math.round(cur.cx * W + Math.cos(ang) * r), Math.round(cur.cy * H + Math.sin(ang) * r - cell * 3), 3, 3);
      }
    }
  };
}
