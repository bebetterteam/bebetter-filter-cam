import { inFace } from "../anchor";
import { LINE, OUTLINE, type Filter } from "./types";

export const bear: Filter = {
  id: "bear",
  icon: "🐻",
  label: "หมี",
  draw(ctx, pose, _bs, t) {
    const bob = Math.sin(t * 2.2) * 0.008;
    inFace(ctx, pose, pose.forehead, () => {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * 0.36, -0.06 + bob * side, 0.14, 0, Math.PI * 2);
        ctx.fillStyle = "#9a6644";
        ctx.fill();
        ctx.lineWidth = LINE;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(side * 0.35, -0.05 + bob * side, 0.075, 0, Math.PI * 2);
        ctx.fillStyle = "#e6b48a";
        ctx.fill();
      }
    });
    inFace(ctx, pose, pose.nose, () => {
      ctx.beginPath();
      ctx.ellipse(0, -0.005, 0.06, 0.042, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#4a2c1e";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-0.02, -0.02, 0.016, 0.009, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff99";
      ctx.fill();
    });
  },
};
