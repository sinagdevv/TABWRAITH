import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { NormalizedLandmark } from '../gestureEngine/gestureEngine';

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'loading-model'
  | 'active'
  | 'denied'
  | 'error';

export interface TrackingPerfMetrics {
  cameraFps: number;
  trackingFps: number;
  inferenceMs: number;
  delegate: 'GPU' | 'CPU';
  gestureState: string;
}

export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [9, 13], [13, 14], [14, 15], [15, 16],// Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17],                              // Palm base
];

let cachedLandmarker: HandLandmarker | null = null;
let initPromise: Promise<HandLandmarker> | null = null;
let activeDelegate: 'GPU' | 'CPU' = 'GPU';

export function getActiveDelegate(): 'GPU' | 'CPU' {
  return activeDelegate;
}

export async function initHandLandmarker(): Promise<HandLandmarker> {
  if (cachedLandmarker) {
    return cachedLandmarker;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const baseUrl = new URL('./mediapipe', window.location.href).href;
    const vision = await FilesetResolver.forVisionTasks(`${baseUrl}/wasm`);

    try {
      cachedLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${baseUrl}/hand_landmarker.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });
      activeDelegate = 'GPU';
    } catch {
      cachedLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${baseUrl}/hand_landmarker.task`,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });
      activeDelegate = 'CPU';
    }

    return cachedLandmarker;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

export function drawHandLandmarks(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[] | null | undefined,
  isFingerGunPose: boolean,
  thumbCocked: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length < 21) return;

  const primaryColor = isFingerGunPose ? '#7BAA9B' : '#E9DFCF';
  const triggerColor = thumbCocked ? '#7BAA9B' : '#B44653';

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);

  ctx.lineWidth = 2.4;
  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const a = landmarks[startIdx];
    const b = landmarks[endIdx];
    if (!a || !b) continue;

    const isThumbBone = startIdx <= 4 && endIdx <= 4;
    ctx.strokeStyle = isThumbBone ? triggerColor : primaryColor;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    const x = pt.x * width;
    const y = pt.y * height;

    const isIndexTip = i === 8;
    const isThumbTip = i === 4;

    ctx.beginPath();
    ctx.arc(x, y, isIndexTip ? 7 : isThumbTip ? 6 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isIndexTip
      ? '#7BAA9B'
      : isThumbTip
      ? triggerColor
      : '#0D0B12';
    ctx.fill();
    ctx.lineWidth = isIndexTip || isThumbTip ? 2 : 1.5;
    ctx.strokeStyle = isIndexTip ? '#FFFFFF' : primaryColor;
    ctx.stroke();
  }

  ctx.restore();
}
