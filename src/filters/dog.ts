import { inFace } from "../anchor";
import { LINE, OUTLINE, type Filter } from "./types";

function ear(ctx: CanvasRenderingContext2D, side: 1 | -1, swing: number) {
  ctx.save();
  ctx.translate(side * 0.36, 0.0);
  ctx.scale(side, 1); // draw the right ear, mirror for the left
  ctx.rotate(0.25 + swing);
  ctx.beginPath();
  ctx.moveTo(-0.08, -0.04);
  ctx.bezierCurveTo(0.25, -0.1, 0.22, 0.38, 0.05, 0.42);
  ctx.bezierCurveTo(-0.08, 0.45, -0.12, 0.2, -0.08, -0.04);
  ctx.fillStyle = "#a8714a";
  ctx.fill();
  ctx.lineWidth = LINE;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
}

export const dog: Filter = {
  id: "dog",
  label: "หมา",
  draw(ctx, pose, bs, t) {
    const swing = Math.sin(t * 3) * 0.04;
    inFace(ctx, pose, pose.forehead, () => {
      ear(ctx, -1, swing);
      ear(ctx, 1, swing);
    });

    // tongue when the mouth opens
    const open = bs.jawOpen ?? 0;
    if (open > 0.25) {
      const len = Math.min(1, (open - 0.25) / 0.45) * 0.22;
      inFace(ctx, pose, pose.mouthBottom, () => {
        ctx.beginPath();
        ctx.moveTo(-0.075, -0.02);
        ctx.lineTo(-0.075, len * 0.6);
        ctx.quadraticCurveTo(-0.075, len + 0.05, 0, len + 0.05);
        ctx.quadraticCurveTo(0.075, len + 0.05, 0.075, len * 0.6);
        ctx.lineTo(0.075, -0.02);
        ctx.closePath();
        ctx.fillStyle = "#ff6f91";
        ctx.fill();
        ctx.lineWidth = LINE * 0.7;
        ctx.strokeStyle = "#c2405f";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, len * 0.7);
        ctx.stroke();
      });
    }

    inFace(ctx, pose, pose.nose, () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.075, 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#2d1f1a";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-0.025, -0.018, 0.022, 0.012, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffffaa";
      ctx.fill();
    });
  },
};
