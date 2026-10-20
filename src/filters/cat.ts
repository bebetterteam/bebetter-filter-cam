import { inFace } from "../anchor";
import { LINE, OUTLINE, type Filter } from "./types";

function ear(ctx: CanvasRenderingContext2D, side: 1 | -1, twitch: number) {
  ctx.save();
  ctx.translate(side * 0.3, -0.02);
  ctx.rotate(side * (0.32 + twitch));
  ctx.beginPath();
  ctx.moveTo(-0.17, 0);
  ctx.quadraticCurveTo(-0.1, -0.3, 0, -0.42);
  ctx.quadraticCurveTo(0.1, -0.3, 0.17, 0);
  ctx.closePath();
  ctx.fillStyle = "#f7c58b";
  ctx.fill();
  ctx.lineWidth = LINE;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.03);
  ctx.quadraticCurveTo(-0.05, -0.22, 0, -0.31);
  ctx.quadraticCurveTo(0.05, -0.22, 0.1, -0.03);
  ctx.closePath();
  ctx.fillStyle = "#ffa3bd";
  ctx.fill();
  ctx.restore();
}

export const cat: Filter = {
  id: "cat",
  icon: "🐱",
  label: "แมว",
  draw(ctx, pose, _bs, t) {
    // occasional ear twitch
    const twitch = Math.max(0, Math.sin(t * 0.9) - 0.96) * 4;
    inFace(ctx, pose, pose.forehead, () => {
      ear(ctx, -1, -twitch * 0.3);
      ear(ctx, 1, twitch * 0.3);
    });
    inFace(ctx, pose, pose.nose, () => {
      // nose
      ctx.beginPath();
      ctx.moveTo(-0.045, -0.02);
      ctx.quadraticCurveTo(0, -0.04, 0.045, -0.02);
      ctx.quadraticCurveTo(0.03, 0.025, 0, 0.035);
      ctx.quadraticCurveTo(-0.03, 0.025, -0.045, -0.02);
      ctx.fillStyle = "#ff7fa3";
      ctx.fill();
      ctx.lineWidth = LINE * 0.7;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      // whiskers
      ctx.lineCap = "round";
      ctx.lineWidth = LINE * 0.6;
      ctx.strokeStyle = "#5a3a2ecc";
      for (const side of [-1, 1]) {
        for (const [dy, tilt] of [[0.03, -0.06], [0.07, 0], [0.11, 0.06]]) {
          ctx.beginPath();
          ctx.moveTo(side * 0.12, dy);
          ctx.quadraticCurveTo(side * 0.25, dy + tilt - 0.01, side * 0.38, dy + tilt * 1.6);
          ctx.stroke();
        }
      }
    });
  },
};
