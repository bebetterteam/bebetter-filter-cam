import type { Pose } from "./anchor";

/** A front-facing pose with no camera — for thumbnails and the move guide. */
export function synthPose(cx: number, cy: number, s: number, roll = 0): Pose {
  const p = (x: number, y: number) => ({ x, y });
  return {
    roll, yaw: 0, pitch: 0, size: s, center: p(cx, cy),
    forehead: p(cx, cy - s * 0.6), chin: p(cx, cy + s * 0.6), nose: p(cx, cy + s * 0.05),
    mouthTop: p(cx, cy + s * 0.3), mouthBottom: p(cx, cy + s * 0.34),
    leftEye: p(cx + s * 0.2, cy - s * 0.15), rightEye: p(cx - s * 0.2, cy - s * 0.15),
    leftCheek: p(cx + s * 0.3, cy + s * 0.12), rightCheek: p(cx - s * 0.3, cy + s * 0.12),
  };
}
