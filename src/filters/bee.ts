import { fromFace, inFace, type Pose } from "../anchor";
import type { Blendshapes } from "../tracker";
import { ARM_L, ARM_R, BODY, EAR_L, EAR_R, ORIGIN, TAIL, TAIL_STRIPES } from "./bee-geometry";
import type { Extras, Filter } from "./types";

// "Bee" from the BeBetter character sheet (public/ref/BeBetter_sheet_Bee.svg).
// Body/ears/tail/arms are the sheet's own paths (bee-geometry.ts); face features use the
// sheet's EXPRESSIONS cells, measured in "small" units and scaled by S into FRONT units.

const MAIN = "#4360FF";
const SHADE = "#2436B8";
const WHITE = "#FFFFFF";
const INK = "#1A1A1A";
const HEART = "#FC6129";
const TONGUE = "#E0475B";
const OUTLINE = 28; // sticker outline: every silhouette shape is stroked +28 in white first

const S = 102.6 / 36; // small expression cell → FRONT units
const BODY_W = 885.89 - 234.31;
const BODY_CENTER = { x: (234.31 + 885.89) / 2, y: (781.99 + 1472.14) / 2 };
const FIT = 1.75 / BODY_W; // body is 1.75 face-widths wide, centered on the face

const bodyPath = new Path2D(BODY);
const earL = new Path2D(EAR_L);
const earR = new Path2D(EAR_R);

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** small-cell coords (relative to the eye midpoint) → FRONT coords */
const X = (sx: number) => ORIGIN.x + sx * S;
const Y = (sy: number) => ORIGIN.y + sy * S;

const EYE_DX = 18, EYE_RX = 19, EYE_RY = 19.95;

type Pass = "outline" | "fill";

function strokeLine(ctx: CanvasRenderingContext2D, pass: Pass, color: string, width: number, cap: CanvasLineCap) {
  ctx.lineCap = pass === "outline" ? "round" : cap;
  ctx.lineJoin = "round";
  ctx.lineWidth = width + (pass === "outline" ? OUTLINE : 0);
  ctx.strokeStyle = pass === "outline" ? WHITE : color;
  ctx.stroke();
}

function shape(ctx: CanvasRenderingContext2D, pass: Pass, path: Path2D, color: string, stroke = 0) {
  ctx.fillStyle = pass === "outline" ? WHITE : color;
  ctx.fill(path);
  const w = stroke + (pass === "outline" ? OUTLINE : 0);
  if (w > 0) {
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = pass === "outline" ? "round" : "butt";
    ctx.strokeStyle = pass === "outline" ? WHITE : color;
    ctx.stroke(path);
  }
}

function tail(ctx: CanvasRenderingContext2D, pass: Pass, wag: number) {
  const [bx, by] = TAIL[0];
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(wag);
  ctx.translate(-bx, -by);
  ctx.beginPath();
  TAIL.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  strokeLine(ctx, pass, MAIN, 125.4, "round");
  if (pass === "fill") {
    for (const [[x1, y1], [x2, y2]] of TAIL_STRIPES) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      strokeLine(ctx, pass, SHADE, 125.4, "butt");
    }
  }
  ctx.restore();
}

function ear(ctx: CanvasRenderingContext2D, pass: Pass, path: Path2D, pivot: [number, number], tilt: number) {
  ctx.save();
  ctx.translate(pivot[0], pivot[1]);
  ctx.rotate(tilt);
  ctx.translate(-pivot[0], -pivot[1]);
  shape(ctx, pass, path, SHADE, 62.7);
  ctx.restore();
}

type Arm = typeof ARM_L | typeof ARM_R;

/** Rubber-hose arm from the cheer pose; `raise` 0 = tucked behind the body, 1 = fully up. */
function arm(ctx: CanvasRenderingContext2D, pass: Pass, a: Arm, raise: number, wave: number) {
  if (raise <= 0.02) return;
  const [sx, sy] = a.start;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(wave);
  ctx.translate(-sx, -sy);
  const cx = lerp(sx, a.ctrl[0], raise), cy = lerp(sy, a.ctrl[1], raise);
  const ex = lerp(sx, a.end[0], raise), ey = lerp(sy, a.end[1], raise);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, ex, ey);
  strokeLine(ctx, pass, MAIN, 70.1, "round");

  const dx = ex - a.end[0], dy = ey - a.end[1];
  const [px, py, pr] = a.paw;
  ctx.beginPath();
  ctx.arc(px + dx, py + dy, pr, 0, Math.PI * 2);
  if (pass === "outline") {
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.lineWidth = OUTLINE;
    ctx.strokeStyle = WHITE;
    ctx.stroke();
  } else {
    ctx.fillStyle = MAIN;
    ctx.fill();
    ctx.fillStyle = SHADE;
    for (const [qx, qy, qr] of a.pads) {
      ctx.beginPath();
      ctx.arc(qx + dx, qy + dy, qr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

interface EyeState {
  /** 0 = open, 1 = the sheet's "meh" half-lid */
  lid: number;
  closed: boolean;
  heart: boolean;
  gx: number;
  gy: number;
}

function eye(ctx: CanvasRenderingContext2D, pass: Pass, side: -1 | 1, e: EyeState) {
  const cx = side * EYE_DX;
  if (e.heart) {
    // hearts: orange heart replaces the eye
    ctx.beginPath();
    ctx.moveTo(X(cx), Y(15.9));
    ctx.bezierCurveTo(X(cx - 25.5), Y(-1.1), X(cx - 15.3), Y(-24.9), X(cx), Y(-9.6));
    ctx.bezierCurveTo(X(cx + 15.3), Y(-24.9), X(cx + 25.5), Y(-1.1), X(cx), Y(15.9));
    ctx.closePath();
    if (pass === "outline") {
      ctx.lineWidth = OUTLINE;
      ctx.lineJoin = "round";
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    }
    ctx.fillStyle = pass === "outline" ? WHITE : HEART;
    ctx.fill();
    return;
  }
  if (e.closed) {
    // bliss: the sheet's closed-eye arc, nudged down 12 units so it reads on the blue head
    // instead of vanishing against the same-colored ears
    if (pass === "outline") return;
    const dy = 12;
    ctx.beginPath();
    ctx.moveTo(X(cx - 13.54), Y(-0.9 + dy));
    ctx.bezierCurveTo(X(cx - 10.95), Y(-5.99 + dy), X(cx - 5.72), Y(-9.2 + dy), X(cx), Y(-9.2 + dy));
    ctx.bezierCurveTo(X(cx + 5.72), Y(-9.2 + dy), X(cx + 10.95), Y(-5.99 + dy), X(cx + 13.54), Y(-0.9 + dy));
    strokeLine(ctx, pass, SHADE, 7 * S, "round");
    return;
  }

  // white eyeball (pokes above the head, so it gets the sticker outline too)
  ctx.beginPath();
  ctx.ellipse(X(cx), Y(0), EYE_RX * S, EYE_RY * S, 0, 0, Math.PI * 2);
  if (pass === "outline") {
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.lineWidth = OUTLINE;
    ctx.strokeStyle = WHITE;
    ctx.stroke();
  } else {
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const px = cx + e.gx * 7, py = 0.95 + e.gy * 5;
    ctx.beginPath();
    ctx.arc(X(px), Y(py), 6.46 * S, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(px - 2.28), Y(py - 2.85), 1.9 * S, 0, Math.PI * 2);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.restore();
  }

  // upper lid (meh / smirk / เศร้า): body-colored cap with a shade line at its edge
  if (e.lid > 0.02) {
    const top = -25.65, bottom = lerp(-EYE_RY, -2.85, e.lid);
    ctx.beginPath();
    ctx.rect(X(cx - 23.75), Y(top), 47.5 * S, (bottom - top) * S);
    if (pass === "outline") {
      ctx.lineWidth = OUTLINE;
      ctx.lineJoin = "round";
      ctx.strokeStyle = WHITE;
      ctx.stroke();
      return;
    }
    ctx.fillStyle = MAIN;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(X(cx - 19.95), Y(bottom));
    ctx.lineTo(X(cx + 19.95), Y(bottom));
    strokeLine(ctx, pass, SHADE, 5 * S, "butt");
  }
}

function brows(ctx: CanvasRenderingContext2D, angry: number, sad: number) {
  ctx.save();
  if (angry > 0.02) {
    // หงุดหงิด: ink brows slanting down toward the middle
    ctx.globalAlpha = angry;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(X(s * 30), Y(-36));
      ctx.lineTo(X(s * 8), Y(-22));
      strokeLine(ctx, "fill", INK, 9 * S, "round");
    }
  }
  if (sad > 0.02) {
    // เศร้า: shade brows rising toward the middle
    ctx.globalAlpha = sad;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(X(s * 30), Y(-24));
      ctx.lineTo(X(s * 8), Y(-38));
      strokeLine(ctx, "fill", SHADE, 9 * S, "round");
    }
  }
  ctx.restore();
}

type MouthShape = "calm" | "happy" | "smirk" | "alert" | "shout";

function mouth(ctx: CanvasRenderingContext2D, kind: MouthShape, jaw: number, flip: boolean) {
  ctx.save();
  if (flip) {
    // smirk toward the other side: mirror around the mouth's own center
    ctx.translate(X(12), 0);
    ctx.scale(-1, 1);
    ctx.translate(-X(12), 0);
  }
  ctx.fillStyle = SHADE;
  switch (kind) {
    case "calm":
      ctx.beginPath();
      ctx.moveTo(X(-6), Y(38));
      ctx.quadraticCurveTo(X(10), Y(50), X(28), Y(36));
      strokeLine(ctx, "fill", SHADE, 8 * S, "round");
      break;
    case "happy":
      ctx.beginPath();
      ctx.moveTo(X(-18), Y(32));
      ctx.quadraticCurveTo(X(8), Y(78), X(36), Y(30));
      ctx.quadraticCurveTo(X(8), Y(46), X(-18), Y(32));
      ctx.fill();
      break;
    case "smirk":
      ctx.beginPath();
      ctx.moveTo(X(-12), Y(42));
      ctx.quadraticCurveTo(X(12), Y(54), X(34), Y(26));
      strokeLine(ctx, "fill", SHADE, 9 * S, "round");
      ctx.beginPath();
      ctx.moveTo(X(30), Y(20));
      ctx.quadraticCurveTo(X(40), Y(28), X(36), Y(36));
      strokeLine(ctx, "fill", SHADE, 6 * S, "round");
      break;
    case "alert":
      ctx.beginPath();
      ctx.ellipse(X(8), Y(40), 6 * S, 8 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "shout": {
      // ตะโกน: grows with how wide the jaw is open
      const k = 0.7 + 0.3 * clamp((jaw - 0.38) / 0.4);
      ctx.beginPath();
      ctx.ellipse(X(8), Y(52), 30 * S * (0.85 + 0.15 * k), 24 * S * k, 0, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(X(8), Y(52 + 12 * k), 16 * S, 9 * S, 0, 0, Math.PI * 2);
      ctx.fillStyle = TONGUE;
      ctx.fill();
      ctx.restore();
      break;
    }
  }
  ctx.restore();
}

// smoothed animation state (arms, lids) — module-level is fine: one face, one filter instance
const anim = { cheer: 0, paw: 0, last: 0 };

function pickMouth(g: (k: string) => number): { kind: MouthShape; flip: boolean } {
  const jaw = g("jawOpen");
  const sl = g("mouthSmileLeft"), sr = g("mouthSmileRight"); // subject's left = image right
  if (jaw > 0.38) return { kind: "shout", flip: false };
  if (jaw > 0.15) return { kind: "alert", flip: false };
  if (Math.abs(sl - sr) > 0.22 && Math.max(sl, sr) > 0.3) return { kind: "smirk", flip: sr > sl };
  if ((sl + sr) / 2 > 0.4) return { kind: "happy", flip: false };
  return { kind: "calm", flip: false };
}

export const bee: Filter = {
  id: "bee",
  icon: "🐾",
  label: "บี",
  mask: true,

  remap(pose: Pose): Pose {
    const at = pose.center;
    const f = (sx: number, sy: number) =>
      fromFace(pose, at, (X(sx) - BODY_CENTER.x) * FIT, (Y(sy) - BODY_CENTER.y) * FIT);
    return {
      ...pose,
      forehead: f(0, -26),
      leftEye: f(EYE_DX, 0),
      rightEye: f(-EYE_DX, 0),
      nose: f(2, 22),
      mouthTop: f(8, 36),
      mouthBottom: f(8, 44),
      leftCheek: f(40, 30),
      rightCheek: f(-36, 30),
    };
  },

  draw(ctx, pose, bs: Blendshapes, t, ex: Extras) {
    const g = (k: string) => bs[k] ?? 0;
    const dt = clamp(t - anim.last, 0, 0.1);
    anim.last = t;
    const mood = ex.mood;
    const level = ex.moodLevel;
    const smile = (g("mouthSmileLeft") + g("mouthSmileRight")) / 2;

    // arms: cheer both when really happy, one waving paw while the "รับทราบ" sticker is up
    const cheerTarget = mood === "happy" && smile > 0.7 ? 1 : 0;
    anim.cheer += (cheerTarget - anim.cheer) * clamp(dt * 8);
    anim.paw += (ex.paw - anim.paw) * clamp(dt * 10);

    const { kind, flip } = pickMouth(g);
    const lidFor = (blink: number) => {
      let lid = clamp((blink - 0.2) / 0.4);
      if (mood === "sad") lid = Math.max(lid, level);
      if (kind === "smirk") lid = Math.max(lid, 1);
      return lid;
    };
    const heart = g("mouthPucker") > 0.55 && g("jawOpen") < 0.15;
    const sleepy = mood === "sleepy";
    const gx = clamp((g("eyeLookInRight") - g("eyeLookOutRight") + g("eyeLookOutLeft") - g("eyeLookInLeft")) / 2, -1, 1);
    const gy = clamp((g("eyeLookDownLeft") + g("eyeLookDownRight") - g("eyeLookUpLeft") - g("eyeLookUpRight")) / 2, -1, 1);
    // image-left eye is the subject's right eye
    const eyeL: EyeState = { lid: lidFor(g("eyeBlinkRight")), closed: sleepy || g("eyeBlinkRight") > 0.65, heart, gx, gy };
    const eyeR: EyeState = { lid: lidFor(g("eyeBlinkLeft")), closed: sleepy || g("eyeBlinkLeft") > 0.65, heart, gx, gy };

    const wag = Math.sin(t * (1.6 + (mood === "happy" ? level * 3 : 0))) * 0.07;
    const twitch = Math.max(0, Math.sin(t * 0.7) - 0.96) * 6;
    const wave = Math.sin(t * 9) * 0.06;
    // features slide a little with head turn / nod
    const fx = (pose.yaw * 0.25) / FIT, fy = (pose.pitch * 0.35) / FIT;

    inFace(ctx, pose, pose.center, () => {
      ctx.scale(FIT, FIT);
      ctx.translate(-BODY_CENTER.x, -BODY_CENTER.y);

      for (const pass of ["outline", "fill"] as const) {
        // back to front, like the sheet: arms, tail, ears, body, face
        arm(ctx, pass, ARM_L, anim.cheer, -wave * anim.cheer);
        arm(ctx, pass, ARM_R, Math.max(anim.cheer, anim.paw), wave * Math.max(anim.cheer, anim.paw * 2));
        tail(ctx, pass, wag);
        ear(ctx, pass, earL, [428.9, 840.15], -twitch * 0.15);
        ear(ctx, pass, earR, [656.9, 840.15], 0);
        shape(ctx, pass, bodyPath, MAIN);
        ctx.save();
        ctx.translate(fx, fy);
        eye(ctx, pass, -1, eyeL);
        eye(ctx, pass, 1, eyeR);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(fx, fy);
      brows(ctx, mood === "angry" ? level : 0, mood === "sad" ? level : 0);
      // nose
      ctx.beginPath();
      ctx.ellipse(X(2), Y(22), 9 * S, 6 * S, 0, 0, Math.PI * 2);
      ctx.fillStyle = SHADE;
      ctx.fill();
      mouth(ctx, kind, g("jawOpen"), flip);
      ctx.restore();
    });
  },
};
