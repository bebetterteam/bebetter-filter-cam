import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type Blendshapes = Record<string, number>;

export interface FaceResult {
  landmarks: NormalizedLandmark[];
  blendshapes: Blendshapes;
}

export class Tracker {
  private constructor(private landmarker: FaceLandmarker) {}

  static async create(): Promise<Tracker> {
    const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
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
      console.warn("[CuteCam] GPU delegate failed, falling back to CPU", err);
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
