import { fromFace, inFace, type Pose } from "../anchor";
import type { Blendshapes } from "../tracker";
import type { Extras, Filter } from "./types";

// Inspired by the blue cat sticker in public/ref — drawn procedurally so every part can move.
const BLUE = "#4a5ae8";
const BLUE_DARK = "#3443c4";
const BLUE_LIGHT = "#6d7cf7";
const EAR_INNER = "#97a3ff";
const INK = "#1d1f5e";

// Feature positions in face space (origin = face center, 1 unit = face width, y down)
const EYE = { x: 0.15, y: -0.47, rx: 0.14, ry: 0.16 };
const BROW_Y = -0.7;
const MOUTH = { x: 0, y: -0.2 };
const CHEEK = { x: 0.33, y: -0.24 };

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function headPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-0.86, 0.85);
  ctx.bezierCurveTo(-0.94, 0.05, -0.74, -0.96, 0, -0.96);
  ctx.bezierCurveTo(0.74, -0.96, 0.94, 0.05, 0.86, 0.85);
  ctx.quadraticCurveTo(0, 0.97, -0.86, 0.85);
  ctx.closePath();
}

function ear(ctx: CanvasRenderingContext2D, side: 1 | -1, tilt: number) {
  ctx.save();
  ctx.translate(side * 0.42, -0.74);
  ctx.rotate(side * tilt);
  ctx.beginPath();
  ctx.moveTo(-0.24, 0.12);
  ctx.quadraticCurveTo(side * 0.02 - 0.12, -0.3, side * 0.08, -0.52);
  ctx.quadraticCurveTo(side * 0.02 + 0.16, -0.25, 0.24, 0.1);
  ctx.closePath();
  ctx.fillStyle = BLUE;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.12, 0.05);
  ctx.quadraticCurveTo(side * 0.03 - 0.06, -0.22, side * 0.07, -0.38);
  ctx.quadraticCurveTo(side * 0.03 + 0.09, -0.18, 0.13, 0.04);
  ctx.closePath();
  ctx.fillStyle = EAR_INNER;
  ctx.fill();
  ctx.restore();
}

function tail(ctx: CanvasRenderingContext2D, wag: number) {
  ctx.save();
  ctx.translate(-0.72, 0.62);
  ctx.rotate(wag);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-0.38, 0.02, -0.5, -0.35, -0.36, -0.78);
  ctx.lineCap = "round";
  ctx.lineWidth = 0.17;
  ctx.strokeStyle = BLUE;
  ctx.stroke();
  // stripes: a dashed stroke along the same curve
  ctx.lineCap = "butt";
  ctx.setLineDash([0.06, 0.07]);
  ctx.lineDashOffset = -0.12;
  ctx.strokeStyle = BLUE_DARK;
  ctx.stroke();
  ctx.restore();
}

function paw(ctx: CanvasRenderingContext2D, raise: number, t: number) {
  if (raise <= 0.01) return;
  ctx.save();
  ctx.translate(0.8, 0.45);
  ctx.rotate(0.35 + Math.sin(t * 9) * 0.15 * raise);
  const len = 0.2 + raise * 0.55;
  ctx.beginPath();
  ctx.moveTo(-0.05, 0);
  ctx.quadraticCurveTo(0.2, -len * 0.4, 0.12, -len);
  ctx.lineCap = "round";
  ctx.lineWidth = 0.19;
  ctx.strokeStyle = BLUE;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.12, -len - 0.04, 0.12, 0, Math.PI * 2);
  ctx.fillStyle = BLUE_LIGHT;
  ctx.fill();
  ctx.lineWidth = 0.014;
  ctx.strokeStyle = INK;
  for (const dx of [-0.04, 0.04]) {
    ctx.beginPath();
    ctx.moveTo(0.12 + dx, -len - 0.15);
    ctx.lineTo(0.12 + dx, -len - 0.09);
    ctx.stroke();
  }
  ctx.restore();
}

interface EyeState { blink: number; squint: number; wide: number; gx: number; gy: number; happy: boolean }

function eye(ctx: CanvasRenderingContext2D, cx: number, e: EyeState) {
  const cy = EYE.y, rx = EYE.rx, ry = EYE.ry * (1 + e.wide * 0.18);
  const close = clamp(e.blink * 1.2 - 0.1);

  if (close <= 0.9) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.clip();
    // pupil + highlight
    const px = cx + e.gx * rx * 0.45, py = cy + 0.02 + e.gy * ry * 0.35;
    ctx.beginPath();
    ctx.arc(px, py, 0.062 * (1 - e.wide * 0.15), 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px - 0.02, py - 0.022, 0.018, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    // eyelids
    ctx.fillStyle = BLUE;
    ctx.fillRect(cx - rx, cy - ry - 0.01, rx * 2, ry * 2 * close + 0.01);
    const bottom = clamp(e.squint * 0.45);
    ctx.fillRect(cx - rx, cy + ry - ry * 2 * bottom, rx * 2, ry * 2 * bottom + 0.01);
    ctx.restore();
  }

  ctx.lineWidth = 0.016;
  ctx.strokeStyle = INK;
  if (close > 0.9) {
    // closed: happy "^" or sleepy "—"
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineWidth = 0.024;
    if (e.happy) {
      ctx.moveTo(cx - rx * 0.7, cy + 0.03);
      ctx.quadraticCurveTo(cx, cy - 0.09, cx + rx * 0.7, cy + 0.03);
    } else {
      ctx.moveTo(cx - rx * 0.7, cy);
      ctx.quadraticCurveTo(cx, cy + 0.05, cx + rx * 0.7, cy);
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function brow(ctx: CanvasRenderingContext2D, side: 1 | -1, up: number, down: number, inner: number) {
  ctx.save();
  // side: -1 = image-left brow (inner end on its right), +1 = image-right brow
  ctx.translate(side * EYE.x, BROW_Y - up * 0.07 + down * 0.05);
  ctx.rotate(-side * (down * 0.55 - inner * 0.4));
  ctx.beginPath();
  ctx.moveTo(-0.07, 0);
  ctx.quadraticCurveTo(0, -0.025, 0.07, 0);
  ctx.lineCap = "round";
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

function mouth(ctx: CanvasRenderingContext2D, bs: Blendshapes) {
  const g = (k: string) => bs[k] ?? 0;
  const smile = (g("mouthSmileLeft") + g("mouthSmileRight")) / 2;
  const frown = (g("mouthFrownLeft") + g("mouthFrownRight")) / 2;
  const jaw = g("jawOpen"), pucker = g("mouthPucker");
  // mouthLeft = subject's left = image right
  const mx = MOUTH.x + (g("mouthLeft") - g("mouthRight")) * 0.08;
  const my = MOUTH.y;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.022;

  if (jaw > 0.15) {
    const w = 0.07 + jaw * 0.04 + smile * 0.05 - pucker * 0.04;
    const h = 0.02 + jaw * 0.1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mx - w, my);
    ctx.quadraticCurveTo(mx, my - 0.03 + smile * 0.02, mx + w, my);
    ctx.quadraticCurveTo(mx + w * 0.9, my + h * 1.6, mx, my + h * 1.7);
    ctx.quadraticCurveTo(mx - w * 0.9, my + h * 1.6, mx - w, my);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(mx, my + h * 1.7, w * 0.7, h * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ff7d9c";
    ctx.fill();
    ctx.restore();
    ctx.stroke();
  } else if (pucker > 0.45) {
    ctx.beginPath();
    ctx.ellipse(mx, my + 0.01, 0.03, 0.035, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const w = 0.06 + smile * 0.05;
    const curve = 0.035 + smile * 0.06 - frown * 0.1;
    ctx.beginPath();
    ctx.moveTo(mx - w, my - smile * 0.02);
    ctx.quadraticCurveTo(mx, my + curve, mx + w, my - smile * 0.02);
    ctx.stroke();
  }
}

function moodSymbol(ctx: CanvasRenderingContext2D, ex: Extras, t: number) {
  const k = ex.moodLevel;
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = k;
  switch (ex.mood) {
    case "angry": {
      // 💢 anger mark, pulsing
      ctx.translate(0.6, -0.86);
      const s = 1 + Math.sin(t * 10) * 0.08;
      ctx.scale(s, s);
      ctx.strokeStyle = "#ff3b5c";
      ctx.lineWidth = 0.035;
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(0.035, -0.12);
        ctx.quadraticCurveTo(0.035, -0.035, 0.12, -0.035);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case "sad": {
      // 💧 tear rolling down from the image-left eye
      const p = (t * 0.7) % 1;
      ctx.globalAlpha = k * Math.min(1, (1 - p) * 2);
      ctx.translate(-EYE.x - 0.05, EYE.y + 0.14 + p * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, -0.05);
      ctx.quadraticCurveTo(0.035, 0, 0.03, 0.02);
      ctx.arc(0, 0.02, 0.03, 0, Math.PI);
      ctx.quadraticCurveTo(-0.035, 0, 0, -0.05);
      ctx.fillStyle = "#9fe0ff";
      ctx.fill();
      break;
    }
    case "surprised": {
      // ❗
      ctx.translate(0.62, -1.0 - Math.abs(Math.sin(t * 8)) * 0.04);
      ctx.rotate(0.15);
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.018;
      ctx.beginPath();
      ctx.moveTo(-0.045, -0.2);
      ctx.lineTo(0.045, -0.2);
      ctx.lineTo(0.022, 0.02);
      ctx.lineTo(-0.022, 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0.08, 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "sleepy": {
      // 💤 floating Z's — un-flip when mirrored so the letters read correctly
      ctx.translate(0.55, -0.9);
      if (ex.mirror) ctx.scale(-1, 1);
      ctx.scale(0.01, 0.01);
      ctx.font = "700 20px Mitr, sans-serif";
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.5 + i / 3) % 1;
        ctx.save();
        ctx.globalAlpha = k * Math.sin(p * Math.PI);
        ctx.translate(p * 18, -p * 40);
        const s = 0.8 + p * 0.8;
        ctx.scale(s, s);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#fff";
        ctx.strokeText("Z", 0, 0);
        ctx.fillStyle = INK;
        ctx.fillText("Z", 0, 0);
        ctx.restore();
      }
      break;
    }
  }
  ctx.restore();
}

export const bluecat: Filter = {
  id: "bluecat",
  icon: "💙",
  label: "แมวฟ้า",
  mask: true,

  remap(pose: Pose): Pose {
    const at = pose.center;
    const f = (x: number, y: number) => fromFace(pose, at, x, y);
    const ox = pose.yaw * 0.35, oy = pose.pitch * 0.45;
    return {
      ...pose,
      forehead: f(0, -0.96),
      nose: f(ox, MOUTH.y - 0.06 + oy),
      mouthTop: f(ox, MOUTH.y + oy),
      mouthBottom: f(ox, MOUTH.y + 0.06 + oy),
      rightEye: f(-EYE.x + ox, EYE.y + oy),
      leftEye: f(EYE.x + ox, EYE.y + oy),
      rightCheek: f(-CHEEK.x + ox, CHEEK.y + oy),
      leftCheek: f(CHEEK.x + ox, CHEEK.y + oy),
    };
  },

  draw(ctx, pose, bs, t, ex) {
    const g = (k: string) => bs[k] ?? 0;
    const happy = ex.mood === "happy" ? ex.moodLevel : 0;
    const angry = ex.mood === "angry" ? ex.moodLevel : 0;

    inFace(ctx, pose, pose.center, () => {
      // behind the head
      tail(ctx, Math.sin(t * (2 + happy * 4)) * (0.18 + happy * 0.12));
      const twitch = Math.max(0, Math.sin(t * 0.8) - 0.95) * 5;
      ear(ctx, -1, 0.05 + angry * 0.35 + twitch * 0.2);
      ear(ctx, 1, 0.05 + angry * 0.35);

      // head with soft shading (lighter top-left, darker right like the sticker)
      headPath(ctx);
      const grad = ctx.createLinearGradient(-0.9, -0.9, 0.9, 0.6);
      grad.addColorStop(0, BLUE_LIGHT);
      grad.addColorStop(0.45, BLUE);
      grad.addColorStop(1, BLUE_DARK);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      headPath(ctx);
      ctx.clip();
      // features slide with head turn / nod for a bit of 3D feel
      ctx.translate(pose.yaw * 0.35, pose.pitch * 0.45);

      if (happy > 0.01 || g("mouthSmileLeft") + g("mouthSmileRight") > 0.6) {
        const a = Math.max(happy, (g("mouthSmileLeft") + g("mouthSmileRight")) / 2) * 0.7;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(side * CHEEK.x, CHEEK.y, 0.09, 0.055, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 140, 190, ${a})`;
          ctx.fill();
        }
      }

      // gaze: positive gx = looking toward image right (unmirrored)
      const gx = clamp((g("eyeLookInRight") - g("eyeLookOutRight") + g("eyeLookOutLeft") - g("eyeLookInLeft")) / 2, -1, 1);
      const gy = clamp((g("eyeLookDownLeft") + g("eyeLookDownRight") - g("eyeLookUpLeft") - g("eyeLookUpRight")) / 2, -1, 1);
      const isHappy = happy > 0.3;
      // image-left eye is the subject's right eye
      eye(ctx, -EYE.x, {
        blink: g("eyeBlinkRight"), squint: g("eyeSquintRight") + happy * 0.3, wide: g("eyeWideRight"), gx, gy, happy: isHappy,
      });
      eye(ctx, EYE.x, {
        blink: g("eyeBlinkLeft"), squint: g("eyeSquintLeft") + happy * 0.3, wide: g("eyeWideLeft"), gx, gy, happy: isHappy,
      });

      const inner = g("browInnerUp");
      brow(ctx, -1, inner + g("browOuterUpRight"), g("browDownRight"), inner);
      brow(ctx, 1, inner + g("browOuterUpLeft"), g("browDownLeft"), inner);

      mouth(ctx, bs);
      ctx.restore();

      paw(ctx, ex.paw, t);
      moodSymbol(ctx, ex, t);
    });
  },
};
