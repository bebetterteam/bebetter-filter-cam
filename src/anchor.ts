import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface Pt { x: number; y: number }

/**
 * Face pose in canvas pixels. `size` is face width in px.
 * Angles in radians: `roll` = head tilt, `yaw` = turn (+ toward image right), `pitch` = nod (+ looking down).
 * `yaw`/`pitch` are relative to a slowly-adapting neutral, so an off-center camera still reads ~0.
 */
export interface Pose {
  roll: number;
  yaw: number;
  pitch: number;
  size: number;
  center: Pt;
  forehead: Pt;
  chin: Pt;
  nose: Pt;
  mouthTop: Pt;
  mouthBottom: Pt;
  leftEye: Pt;   // subject's left eye (image right when unmirrored)
  rightEye: Pt;
  leftCheek: Pt;
  rightCheek: Pt;
}

// MediaPipe Face Mesh landmark indices
const LM = {
  forehead: 10, chin: 152, nose: 4, noseBase: 2, mouthTop: 13, mouthBottom: 14,
  rightEyeOuter: 33, leftEyeOuter: 263, rightFace: 234, leftFace: 454,
  rightIris: 468, leftIris: 473, rightCheek: 205, leftCheek: 425,
} as const;

export function poseFromLandmarks(lm: NormalizedLandmark[], w: number, h: number): Pose {
  const p = (i: number): Pt => ({ x: lm[i].x * w, y: lm[i].y * h });
  const z = (i: number) => lm[i].z * w; // MediaPipe z uses roughly the same scale as x
  const re = p(LM.rightEyeOuter), le = p(LM.leftEyeOuter);
  const rf = p(LM.rightFace), lf = p(LM.leftFace);
  const fh = p(LM.forehead), chin = p(LM.chin), nb = p(LM.noseBase);
  return {
    roll: Math.atan2(le.y - re.y, le.x - re.x),
    yaw: Math.atan2(z(LM.leftFace) - z(LM.rightFace), Math.hypot(lf.x - rf.x, lf.y - rf.y)),
    // forehead → nose base: neither moves when the jaw opens, so talking doesn't read as nodding
    pitch: Math.atan2(z(LM.noseBase) - z(LM.forehead), Math.hypot(nb.x - fh.x, nb.y - fh.y)),
    size: Math.hypot(lf.x - rf.x, lf.y - rf.y),
    center: { x: (fh.x + chin.x) / 2, y: (fh.y + chin.y) / 2 },
    forehead: fh,
    chin,
    nose: p(LM.nose),
    mouthTop: p(LM.mouthTop),
    mouthBottom: p(LM.mouthBottom),
    leftEye: p(lm.length > LM.leftIris ? LM.leftIris : LM.leftEyeOuter),
    rightEye: p(lm.length > LM.rightIris ? LM.rightIris : LM.rightEyeOuter),
    leftCheek: p(LM.leftCheek),
    rightCheek: p(LM.rightCheek),
  };
}

/** Exponential smoothing so ears don't jitter frame-to-frame, plus a slow neutral for yaw/pitch. */
export class PoseSmoother {
  private prev: Pose | null = null;
  private neutral = { yaw: 0, pitch: 0 };
  constructor(private alpha = 0.55, private neutralAlpha = 0.01) {}

  reset() { this.prev = null; }

  update(raw: Pose): Pose {
    if (!this.prev) this.neutral = { yaw: raw.yaw, pitch: raw.pitch };
    this.neutral.yaw += (raw.yaw - this.neutral.yaw) * this.neutralAlpha;
    this.neutral.pitch += (raw.pitch - this.neutral.pitch) * this.neutralAlpha;
    const next = { ...raw, yaw: raw.yaw - this.neutral.yaw, pitch: raw.pitch - this.neutral.pitch };

    const prev = this.prev;
    if (!prev) return (this.prev = next);
    const a = this.alpha;
    const mix = (u: number, v: number) => u + (v - u) * a;
    const out = {} as Record<string, number | Pt>;
    for (const [k, v] of Object.entries(next)) {
      const u = prev[k as keyof Pose];
      out[k] = typeof v === "number"
        ? mix(u as number, v)
        : { x: mix((u as Pt).x, v.x), y: mix((u as Pt).y, v.y) };
    }
    return (this.prev = out as unknown as Pose);
  }
}

/** Run `fn` in face space: origin at `at`, x along the eye line, 1 unit = face width. */
export function inFace(ctx: CanvasRenderingContext2D, pose: Pose, at: Pt, fn: () => void) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(pose.roll);
  ctx.scale(pose.size, pose.size);
  fn();
  ctx.restore();
}

/** Face-space point (relative to `at`) → canvas pixels. */
export function fromFace(pose: Pose, at: Pt, x: number, y: number): Pt {
  const c = Math.cos(pose.roll), s = Math.sin(pose.roll);
  return { x: at.x + (x * c - y * s) * pose.size, y: at.y + (x * s + y * c) * pose.size };
}
