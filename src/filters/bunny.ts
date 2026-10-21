import { inFace } from "../anchor";
import { LINE, OUTLINE, type Filter } from "./types";

function ear(ctx: CanvasRenderingContext2D, side: 1 | -1, sway: number, flop: boolean) {
  ctx.save();
  ctx.translate(side * 0.17, 0.0);
  ctx.rotate(side * (0.12 + sway));
  if (flop) {
    // one ear folds over at the tip — extra cute
    ctx.beginPath();
    ctx.ellipse(0, -0.24, 0.1, 0.25, 0, 0, Math.PI * 2);
    paint(ctx);
    ctx.save();
    ctx.translate(0, -0.44);
    ctx.rotate(side * 1.1);
    ctx.beginPath();
    ctx.ellipse(0, -0.1, 0.085, 0.14, 0, 0, Math.PI * 2);
    paint(ctx);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, -0.34, 0.1, 0.35, 0, 0, Math.PI * 2);
    paint(ctx);
    ctx.beginPath();
    ctx.ellipse(0, -0.32, 0.05, 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffb3c8";
    ctx.fill();
  }
  ctx.restore();
}

function paint(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#fffafc";
  ctx.fill();
  ctx.lineWidth = LINE;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

export const bunny: Filter = {
  id: "bunny",
  label: "กระต่าย",
  draw(ctx, pose, _bs, t) {
    const sway = Math.sin(t * 1.6) * 0.06;
    inFace(ctx, pose, pose.forehead, () => {
      ear(ctx, -1, sway, false);
      ear(ctx, 1, -sway * 0.7, true);
    });
    inFace(ctx, pose, pose.nose, () => {
      // little heart-shaped nose
      ctx.beginPath();
      ctx.moveTo(0, 0.03);
      ctx.bezierCurveTo(-0.06, -0.005, -0.04, -0.05, 0, -0.025);
      ctx.bezierCurveTo(0.04, -0.05, 0.06, -0.005, 0, 0.03);
      ctx.fillStyle = "#ff8fb1";
      ctx.fill();
      ctx.lineWidth = LINE * 0.6;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    });
  },
};
