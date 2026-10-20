import { CAPTIONS, type Caption, type CaptionId } from "../captions";
import type { Pose } from "../anchor";
import type { Mood } from "./emotion";

const WINDOW = 1.2;    // seconds of head-motion history
const DURATION = 2.2;  // how long a sticker stays up
const NOD_SWING = 0.07;   // rad
const SHAKE_SWING = 0.14; // rad
const TILT = 0.3;         // rad
const TILT_HOLD = 0.6;    // s
// question (Manow): a gentler tilt is enough when the brows are up too
const Q_TILT = 0.18;      // rad
const Q_HOLD = 0.5;       // s
const Q_BROWS = 0.4;      // browInnerUp / browOuterUp score
// observe (Manow): face suddenly ≥ 22% bigger than its recent size = leaning in
const LEAN = 1.22;
const LEAN_REARM = 1.08;
const LEAN_TAU = 2;       // s — how fast "normal distance" adapts

/** Per-frame context from the active filter. */
export interface GestureOpts {
  /** this character asks questions (brows up + tilt → "question") */
  questions?: boolean;
  /** how raised the brows are, 0…1 */
  browUp?: number;
  /** this character reacts to leaning in toward the camera ("observe") */
  observes?: boolean;
}

interface Sample { t: number; pitch: number; yaw: number }

/** Count direction reversals whose swing exceeds `amp` (a nod down-up-down = 2). */
function swings(values: number[], amp: number): number {
  let count = 0, dir = 0, hi = values[0] ?? 0, lo = hi;
  for (const v of values) {
    if (dir === 0) {
      hi = Math.max(hi, v); lo = Math.min(lo, v);
      if (hi - v > amp) { dir = -1; lo = v; }
      else if (v - lo > amp) { dir = 1; hi = v; }
    } else if (dir > 0) {
      if (v > hi) hi = v;
      else if (hi - v > amp) { count++; dir = -1; lo = v; }
    } else {
      if (v < lo) lo = v;
      else if (v - lo > amp) { count++; dir = 1; hi = v; }
    }
  }
  return count;
}

/** Head gestures (nod / shake / tilt) and mood changes → sticker captions. */
export class Gestures {
  private buf: Sample[] = [];
  private active: { id: CaptionId; start: number; caption: Caption } | null = null;
  private cooldownUntil = 0;
  private tiltSince: number | null = null;
  private tiltArmed = true;
  private qSince: number | null = null;
  private sizeBase = 0;
  private leanArmed = true;
  private lastT = 0;
  private lastMood: Mood = "neutral";

  update(pose: Pose | null, mood: Mood, t: number, opts: GestureOpts = {}) {
    if (this.active && t - this.active.start > DURATION) this.active = null;
    const moodChanged = mood !== this.lastMood;
    this.lastMood = mood;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    if (!pose) { this.buf = []; this.tiltSince = null; this.qSince = null; this.sizeBase = 0; return; }

    // leaning in: compare face size with a slowly-adapting "normal" size
    if (!this.sizeBase) this.sizeBase = pose.size;
    const lean = pose.size / this.sizeBase;
    this.sizeBase += (pose.size - this.sizeBase) * Math.min(1, dt / LEAN_TAU);
    if (lean < LEAN_REARM) this.leanArmed = true;

    this.buf.push({ t, pitch: pose.pitch, yaw: pose.yaw });
    while (this.buf.length && t - this.buf[0].t > WINDOW) this.buf.shift();

    if (Math.abs(pose.roll) > TILT) this.tiltSince ??= t;
    else if (Math.abs(pose.roll) < TILT * 0.6) { this.tiltSince = null; this.tiltArmed = true; }
    const asking = opts.questions && Math.abs(pose.roll) > Q_TILT && (opts.browUp ?? 0) > Q_BROWS;
    if (asking) this.qSince ??= t;
    else if (Math.abs(pose.roll) < Q_TILT * 0.6 || (opts.browUp ?? 0) < Q_BROWS * 0.6) this.qSince = null;

    if (t < this.cooldownUntil) return;

    const yawSw = swings(this.buf.map((s) => s.yaw), SHAKE_SWING);
    const pitchSw = swings(this.buf.map((s) => s.pitch), NOD_SWING);
    let fired: CaptionId | null = null;
    if (opts.observes && this.leanArmed && lean > LEAN) {
      fired = "observe";
      this.leanArmed = false;
    } else if (this.qSince !== null && t - this.qSince > Q_HOLD) {
      fired = "question";
      this.qSince = Infinity; // re-arms once you straighten up or relax your brows
      this.tiltArmed = false;
    } else if (yawSw >= 2) fired = "shake";
    else if (pitchSw >= 2 && yawSw === 0) fired = "nod";
    else if (this.tiltArmed && this.tiltSince !== null && t - this.tiltSince > TILT_HOLD) {
      fired = "tilt";
      this.tiltArmed = false;
    } else if (moodChanged && (mood === "surprised" || mood === "angry" || mood === "sad")) fired = mood;

    if (fired) {
      const c = CAPTIONS[fired];
      this.active = { id: fired, start: t, caption: Array.isArray(c) ? c[(Math.random() * c.length) | 0] : c };
      this.cooldownUntil = t + DURATION + 0.4;
      this.buf = [];
    }
  }

  /** The sticker currently showing, and for how long — characters can react to it. */
  current(t: number): { id: CaptionId; age: number } | null {
    return this.active ? { id: this.active.id, age: t - this.active.start } : null;
  }

  /** 0→1 envelope while the nod sticker is up (drives the cat's raised paw). */
  paw(t: number): number {
    if (this.active?.id !== "nod") return 0;
    const age = t - this.active.start;
    return Math.min(1, age / 0.25, (DURATION - age) / 0.35);
  }

  /** Draw the caption in screen space (after the mirror transform is undone) so text reads correctly. */
  drawHud(ctx: CanvasRenderingContext2D, pose: Pose | null, mirror: boolean, t: number) {
    if (!this.active || !pose) return;
    const cap = this.active.caption;
    const age = t - this.active.start;
    const W = ctx.canvas.width;
    const s = pose.size;
    const cx = mirror ? W - pose.center.x : pose.center.x;
    const side = cx < W / 2 ? 1 : -1; // put it where there's more room

    const size = Math.max(28, Math.min(120, s * 0.32));
    const pop = easeOutBack(Math.min(1, age / 0.25));
    const alpha = Math.max(0, Math.min(1, (DURATION - age) / 0.3));

    // keep the whole sticker inside the frame (long questions would run off the edge)
    ctx.save();
    ctx.font = `700 ${size}px Mitr, "Noto Sans Thai", sans-serif`;
    let textW = ctx.measureText(cap.title).width;
    if (cap.sub) {
      ctx.font = `500 ${size * 0.48}px Mitr, "Noto Sans Thai", sans-serif`;
      textW = Math.max(textW, ctx.measureText(cap.sub).width + size * 0.15);
    }
    ctx.restore();
    const margin = size * 0.4; // room for the outline strokes
    let x = cx + side * s * 0.95;
    x = side > 0 ? Math.min(x, W - margin - textW) : Math.max(x, margin + textW);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, pose.center.y - s * 0.75);
    ctx.rotate(side * -0.06 + Math.sin(t * 3) * 0.02);
    ctx.scale(pop, pop);
    ctx.textAlign = side > 0 ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    ctx.font = `700 ${size}px Mitr, "Noto Sans Thai", sans-serif`;
    ctx.lineWidth = size * 0.34;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(cap.title, 0, 0);
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = "#23206b";
    ctx.strokeText(cap.title, 0, 0);
    ctx.fillStyle = "#ffd23f";
    ctx.fillText(cap.title, 0, 0);

    if (cap.sub) {
      const sub = size * 0.48;
      ctx.font = `500 ${sub}px Mitr, "Noto Sans Thai", sans-serif`;
      ctx.lineWidth = sub * 0.35;
      ctx.strokeStyle = "#fff";
      ctx.strokeText(cap.sub, side * size * 0.15, size * 0.85);
      ctx.fillStyle = "#6d6a80";
      ctx.fillText(cap.sub, side * size * 0.15, size * 0.85);
    }
    ctx.restore();
  }
}

function easeOutBack(x: number) {
  const c = 1.70158;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}
