import { FaceLandmarker, FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Pt } from "./anchor";

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type Blendshapes = Record<string, number>;

export interface FaceResult {
  landmarks: NormalizedLandmark[];
  blendshapes: Blendshapes;
}

let fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
const wasmFileset = () => (fileset ??= FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`));

export class Tracker {
  private constructor(private landmarker: FaceLandmarker) {}

  static async create(): Promise<Tracker> {
    const fileset = await wasmFileset();
    const make = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
    try {
      return new Tracker(await make("GPU"));
    } catch (err) {
      console.warn("[BeBetterCam] GPU delegate failed, falling back to CPU", err);
      return new Tracker(await make("CPU"));
    }
  }

  detect(video: HTMLVideoElement, timestamp: number): FaceResult | null {
    const res = this.landmarker.detectForVideo(video, timestamp);
    const landmarks = res.faceLandmarks[0];
    if (!landmarks) return null;
    const blendshapes: Blendshapes = {};
    for (const c of res.faceBlendshapes[0]?.categories ?? []) blendshapes[c.categoryName] = c.score;
    return { landmarks, blendshapes };
  }
}

/** Palm centers (canvas px) of up to two hands — used to make characters raise their arms. */
export class HandTracker {
  private constructor(private landmarker: HandLandmarker) {}

  static async create(): Promise<HandTracker> {
    const fs = await wasmFileset();
    const make = (delegate: "GPU" | "CPU") =>
      HandLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 2,
      });
    try {
      return new HandTracker(await make("GPU"));
    } catch (err) {
      console.warn("[BeBetterCam] hand GPU delegate failed, falling back to CPU", err);
      return new HandTracker(await make("CPU"));
    }
  }

  detect(video: HTMLVideoElement, timestamp: number, w: number, h: number): Pt[] {
    const res = this.landmarker.detectForVideo(video, timestamp);
    // palm center = wrist + the four knuckles
    return res.landmarks.map((lm) => {
      const ids = [0, 5, 9, 13, 17];
      return {
        x: (ids.reduce((a, i) => a + lm[i].x, 0) / ids.length) * w,
        y: (ids.reduce((a, i) => a + lm[i].y, 0) / ids.length) * h,
      };
    });
  }
}
