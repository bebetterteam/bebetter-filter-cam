import { fromFace, inFace, type Pose, type Pt } from "../../anchor";
import type { Mood } from "../../effects/emotion";
import type { Blendshapes } from "../../tracker";
import type { Extras, Filter } from "../types";

// Shared rig for BeBetter character sheets (public/ref/BeBetter_sheet_*.svg).
// Every sheet uses the same template, so body/back/front parts and the cheer-pose arms come
// straight from the sheet (see scripts/extract-bebetter.py), and face features are measured in
// the sheet's small EXPRESSIONS cells ("small units", eye midpoint = 0,0, eyes 36 apart).

export interface Prim { d: string; fill?: string; stroke?: string; width?: number; cap?: string }
export interface ArmGeo {
  start: number[]; ctrl: number[]; end: number[];
  paw: number[]; pads: number[][]; width: number;
}
export interface Geometry {
  ORIGIN: { x: number; y: number };
  /** small units → FRONT units */
  S: number;
  MAIN: string;
  SHADE: string;
  BODY: string;
  BODY_BOX: number[];
  BACK: Prim[];
  FRONT: Prim[];
  ARM_L: ArmGeo;
  ARM_R: ArmGeo;
}

export const WHITE = "#FFFFFF";
export const INK = "#1A1A1A";
export const HEART = "#FC6129";
export const TONGUE = "#E0475B";
const OUTLINE = 28; // sticker outline: silhouette shapes are stroked +28 in white first
const BODY_FACE_WIDTHS = 1.75; // body width relative to the real face width
const ARM_REACH = 1.25; // how far an arm may stretch toward your hand, × the sheet's arm length

export type Pass = "outline" | "fill";
type V = [number, number];

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** What a character's face function gets each frame. */
export interface FaceState {
  g: (k: string) => number;
  mood: Mood;
  level: number;
  smile: number;
  jaw: number;
  /** gaze: +x = toward image right, +y = down; −1…1 */
  gx: number;
  gy: number;
  t: number;
}

/** A part (prims in BACK or FRONT) that rotates around a pivot, e.g. a wagging tail. */
export interface PartAnim {
  layer: "back" | "front";
  idx: number[];
  pivot: V;
  angle(f: FaceState): number;
}

export interface CharacterDef {
  id: string;
  icon: string;
  label: string;
  geo: Geometry;
  parts: PartAnim[];
  /** small-unit spots used to line up particles (hearts from the mouth etc.) */
  anchors: { mouth: V; cheekX: number; cheekY: number };
  /**
   * Birds raise their wings instead of the sheet's rubber-hose arms: FRONT prims `idx` rotate
   * around `pivot` (shoulder) so the wing's `tip` points at your hand.
   */
  wings?: { idx: [number, number]; pivot: [V, V]; tip: [V, V] };
  /** Draw the face (called for both passes; draw only silhouette-affecting bits in "outline"). */
  face(ctx: CanvasRenderingContext2D, pass: Pass, kit: FaceKit, f: FaceState): void;
}

// ───────────────────────────── drawing helpers ─────────────────────────────

const pathCache = new Map<string, Path2D>();
const path = (d: string) => {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
};

export function strokeLine(ctx: CanvasRenderingContext2D, pass: Pass, color: string, width: number, cap: CanvasLineCap) {
  ctx.lineCap = pass === "outline" ? "round" : cap;
  ctx.lineJoin = "round";
  ctx.lineWidth = width + (pass === "outline" ? OUTLINE : 0);
  ctx.strokeStyle = pass === "outline" ? WHITE : color;
  ctx.stroke();
}

function drawPrim(ctx: CanvasRenderingContext2D, pass: Pass, p: Prim) {
  const pth = path(p.d);
  if (p.fill) {
    ctx.fillStyle = pass === "outline" ? WHITE : p.fill;
    ctx.fill(pth);
  }
  if (p.stroke || pass === "outline") {
    const w = (p.width ?? 0) + (pass === "outline" ? OUTLINE : 0);
    if (w <= 0) return;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = pass === "outline" ? "round" : ((p.cap ?? "butt") as CanvasLineCap);
    ctx.strokeStyle = pass === "outline" ? WHITE : p.stroke!;
    ctx.stroke(pth);
  }
}

function fillOrOutline(ctx: CanvasRenderingContext2D, pass: Pass, color: string) {
  if (pass === "outline") {
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.lineWidth = OUTLINE;
    ctx.lineJoin = "round";
    ctx.strokeStyle = WHITE;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/**
 * Rubber-hose arm based on the sheet's cheer pose, re-aimed at `target` (FRONT coords).
 * `k` 0 = tucked behind the body, 1 = reaching the target. The sheet's curve and paw are
 * rotated/stretched as a whole so the arm keeps its shape whichever way it points.
 */
function arm(ctx: CanvasRenderingContext2D, pass: Pass, geo: Geometry, a: ArmGeo, target: V, k: number, wave: number) {
  if (k <= 0.02) return;
  const [sx, sy] = a.start;
  const len0 = Math.hypot(a.end[0] - sx, a.end[1] - sy);
  let tx = target[0] - sx, ty = target[1] - sy;
  const want = Math.hypot(tx, ty);
  if (want > len0 * ARM_REACH) { tx *= (len0 * ARM_REACH) / want; ty *= (len0 * ARM_REACH) / want; }
  if (Math.hypot(tx, ty) < 1) return;
  const ang = Math.atan2(ty, tx) - Math.atan2(a.end[1] - sy, a.end[0] - sx);
  const sc = (Math.hypot(tx, ty) / len0) * k;
  const c = Math.cos(ang), s = Math.sin(ang);
  const rot = (x: number, y: number): V => [x * c - y * s, x * s + y * c];
  const along = (p: number[]): V => { const [x, y] = rot(p[0] - sx, p[1] - sy); return [sx + x * sc, sy + y * sc]; };
  const [ex, ey] = along(a.end);
  const [cx, cy] = along(a.ctrl);
  /** paw parts keep their size, just rotate with the arm */
  const atPaw = (p: number[]): V => { const [x, y] = rot(p[0] - a.end[0], p[1] - a.end[1]); return [ex + x, ey + y]; };

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(wave);
  ctx.translate(-sx, -sy);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, ex, ey);
  strokeLine(ctx, pass, geo.MAIN, a.width, "round");

  const [px, py] = atPaw(a.paw);
  ctx.beginPath();
  ctx.arc(px, py, a.paw[2], 0, Math.PI * 2);
  fillOrOutline(ctx, pass, geo.MAIN);
  if (pass === "fill") {
    ctx.fillStyle = geo.SHADE;
    for (const pad of a.pads) {
      const [qx, qy] = atPaw(pad);
      ctx.beginPath();
      ctx.arc(qx, qy, pad[2], 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ───────────────────────────── face kit ─────────────────────────────

export interface LidStyle {
  /** small-unit y of the lid's top edge, its lowest point (lid = 1), and half width */
  top: number;
  max: number;
  halfW: number;
  /** shade line along the lid edge (Bee) */
  line: boolean;
}

export interface EyeState {
  /** 0 = open, 1 = the sheet's half-lid */
  lid: number;
  closed: boolean;
  heart?: boolean;
  /** shift the whole eye sideways (small units), e.g. Manow's side-eye */
  dx?: number;
}

const EYE_DX = 18, EYE_RX = 19, EYE_RY = 19.95;

export class FaceKit {
  constructor(readonly geo: Geometry, readonly f: FaceState) {}
  /** small-cell coords (relative to the eye midpoint) → FRONT coords */
  X = (sx: number) => this.geo.ORIGIN.x + sx * this.geo.S;
  Y = (sy: number) => this.geo.ORIGIN.y + sy * this.geo.S;
  get S() { return this.geo.S; }

  eye(ctx: CanvasRenderingContext2D, pass: Pass, side: -1 | 1, e: EyeState, lid: LidStyle,
      closedStyle: (cx: number) => void) {
    const { X, Y, S } = this;
    const cx = side * EYE_DX + (e.dx ?? 0);
    if (e.heart) {
      // hearts: orange heart replaces the eye
      ctx.beginPath();
      ctx.moveTo(X(cx), Y(15.9));
      ctx.bezierCurveTo(X(cx - 25.5), Y(-1.1), X(cx - 15.3), Y(-24.9), X(cx), Y(-9.6));
      ctx.bezierCurveTo(X(cx + 15.3), Y(-24.9), X(cx + 25.5), Y(-1.1), X(cx), Y(15.9));
      ctx.closePath();
      fillOrOutline(ctx, pass, HEART);
      return;
    }
    if (e.closed) {
      if (pass === "fill") closedStyle(cx);
      return;
    }
    // white eyeball (pokes above the head, so it gets the sticker outline too)
    ctx.beginPath();
    ctx.ellipse(X(cx), Y(0), EYE_RX * S, EYE_RY * S, 0, 0, Math.PI * 2);
    fillOrOutline(ctx, pass, WHITE);
    if (pass === "fill") {
      ctx.save();
      ctx.clip();
      const px = cx + this.f.gx * 7, py = 0.95 + this.f.gy * 5;
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
    // upper lid: a body-colored cap over the top of the eye
    if (e.lid > 0.02) {
      const bottom = lerp(-EYE_RY, lid.max, e.lid);
      ctx.beginPath();
      ctx.rect(X(cx - lid.halfW), Y(lid.top), 2 * lid.halfW * S, (bottom - lid.top) * S);
      fillOrOutline(ctx, pass, this.geo.MAIN);
      if (pass === "fill" && lid.line) {
        ctx.beginPath();
        ctx.moveTo(X(cx - EYE_RY), Y(bottom));
        ctx.lineTo(X(cx + EYE_RY), Y(bottom));
        strokeLine(ctx, pass, this.geo.SHADE, 5 * S, "butt");
      }
    }
  }

  /** The sheets' brow set: angry (ink, slanting in), sad (shade, rising in), curious (shade, flat). */
  brows(ctx: CanvasRenderingContext2D, b: { angry?: number; sad?: number; curious?: number }) {
    const { X, Y, S } = this;
    const pair = (alpha: number, color: string, outer: number, inner: number) => {
      if (alpha <= 0.02) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(X(s * 30), Y(outer));
        ctx.lineTo(X(s * 8), Y(inner));
        strokeLine(ctx, "fill", color, 9 * S, "round");
      }
      ctx.restore();
    };
    pair(b.angry ?? 0, INK, -36, -22);
    pair(b.sad ?? 0, this.geo.SHADE, -24, -38);
    pair(b.curious ?? 0, this.geo.SHADE, -30, -34);
  }

  /** ตะโกน: the sheets' shouting mouth, grows with the jaw. `at` = its center in small units. */
  shout(ctx: CanvasRenderingContext2D, at: V) {
    const { X, Y, S } = this;
    const k = 0.7 + 0.3 * clamp((this.f.jaw - 0.38) / 0.4);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(X(at[0]), Y(at[1]), 30 * S * (0.85 + 0.15 * k), 24 * S * k, 0, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(X(at[0]), Y(at[1] + 12 * k), 16 * S, 9 * S, 0, 0, Math.PI * 2);
    ctx.fillStyle = TONGUE;
    ctx.fill();
    ctx.restore();
  }
}

// ───────────────────────────── the filter ─────────────────────────────

export function bebetter(def: CharacterDef): Filter {
  const { geo } = def;
  const [bx0, by0, bx1, by1] = geo.BODY_BOX;
  const BODY_W = bx1 - bx0;
  const BODY_CENTER = { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2 };
  const FIT = BODY_FACE_WIDTHS / BODY_W;
  const bodyPath = path(geo.BODY);
  const HAND_RAISED_Y = BODY_CENTER.y + 0.45 / FIT; // ≈ chin height
  const X = (sx: number) => geo.ORIGIN.x + sx * geo.S;
  const Y = (sy: number) => geo.ORIGIN.y + sy * geo.S;

  const anim = {
    cheer: 0, paw: 0, last: 0,
    // per side (image-left / image-right): smoothed hand target in FRONT coords + how raised it is
    hand: [{ x: 0, y: 0, vis: 0 }, { x: 0, y: 0, vis: 0 }],
  };

  const overBody = ([x, y]: V) =>
    ((x - BODY_CENTER.x) / (BODY_W / 2)) ** 2 + ((y - BODY_CENTER.y) / ((by1 - by0) / 2)) ** 2 < 0.75;

  /** canvas px → FRONT coords (inverse of the face transform used in draw) */
  function toFront(pose: Pose, p: Pt): V {
    const dx = p.x - pose.center.x, dy = p.y - pose.center.y;
    const c = Math.cos(pose.roll), s = Math.sin(pose.roll);
    const u = (dx * c + dy * s) / pose.size, v = (-dx * s + dy * c) / pose.size;
    return [u / FIT + BODY_CENTER.x, v / FIT + BODY_CENTER.y];
  }

  function trackHands(pose: Pose, hands: Pt[], dt: number) {
    const pts = hands.map((h) => toFront(pose, h));
    [0, 1].forEach((side) => {
      // each side takes the highest hand on its half of the body
      const mine = pts
        .filter(([x]) => (side === 0 ? x < BODY_CENTER.x : x >= BODY_CENTER.x))
        .sort((p, q) => p[1] - q[1])[0];
      const st = anim.hand[side];
      const raised = mine && mine[1] < HAND_RAISED_Y;
      if (raised) {
        if (st.vis < 0.05) { st.x = mine[0]; st.y = mine[1]; } // snap when it first appears
        const k = clamp(dt * 16);
        st.x += (mine[0] - st.x) * k;
        st.y += (mine[1] - st.y) * k;
      }
      st.vis += ((raised ? 1 : 0) - st.vis) * clamp(dt * (raised ? 12 : 6));
    });
  }

  type Turn = { pivot: V; angle: number };
  function layer(ctx: CanvasRenderingContext2D, pass: Pass, which: "back" | "front", prims: Prim[], f: FaceState,
                 extra?: Map<number, Turn>) {
    const turns = new Map<number, Turn[]>();
    const add = (i: number, t: Turn) => turns.set(i, [...(turns.get(i) ?? []), t]);
    for (const p of def.parts) if (p.layer === which) for (const i of p.idx) add(i, { pivot: p.pivot, angle: p.angle(f) });
    extra?.forEach((t, i) => add(i, t));
    prims.forEach((prim, i) => {
      const ts = turns.get(i);
      if (!ts) return drawPrim(ctx, pass, prim);
      ctx.save();
      for (const t of ts) {
        ctx.translate(t.pivot[0], t.pivot[1]);
        ctx.rotate(t.angle);
        ctx.translate(-t.pivot[0], -t.pivot[1]);
      }
      drawPrim(ctx, pass, prim);
      ctx.restore();
    });
  }

  /** shortest signed angle a→b */
  const turnTo = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

  return {
    id: def.id,
    icon: def.icon,
    label: def.label,
    mask: true,
    wantsHands: true,

    remap(pose: Pose): Pose {
      const f = (sx: number, sy: number) =>
        fromFace(pose, pose.center, (X(sx) - BODY_CENTER.x) * FIT, (Y(sy) - BODY_CENTER.y) * FIT);
      const { mouth, cheekX, cheekY } = def.anchors;
      return {
        ...pose,
        forehead: f(0, -26),
        leftEye: f(EYE_DX, 0),
        rightEye: f(-EYE_DX, 0),
        nose: f(mouth[0], mouth[1] - 10),
        mouthTop: f(mouth[0], mouth[1] - 4),
        mouthBottom: f(mouth[0], mouth[1] + 4),
        leftCheek: f(cheekX, cheekY),
        rightCheek: f(-cheekX, cheekY),
      };
    },

    draw(ctx, pose, bs: Blendshapes, t, ex: Extras) {
      const g = (k: string) => bs[k] ?? 0;
      const dt = clamp(t - anim.last, 0, 0.1);
      anim.last = t;
      const f: FaceState = {
        g, t,
        mood: ex.mood,
        level: ex.moodLevel,
        smile: (g("mouthSmileLeft") + g("mouthSmileRight")) / 2,
        jaw: g("jawOpen"),
        gx: clamp((g("eyeLookInRight") - g("eyeLookOutRight") + g("eyeLookOutLeft") - g("eyeLookInLeft")) / 2, -1, 1),
        gy: clamp((g("eyeLookDownLeft") + g("eyeLookDownRight") - g("eyeLookUpLeft") - g("eyeLookUpRight")) / 2, -1, 1),
      };
      const kit = new FaceKit(geo, f);

      // arms: cheer both when really happy, one waving paw while the "รับทราบ" sticker is up,
      // and your real raised hands override either side
      const cheerTarget = f.mood === "happy" && f.smile > 0.7 ? 1 : 0;
      anim.cheer += (cheerTarget - anim.cheer) * clamp(dt * 8);
      anim.paw += (ex.paw - anim.paw) * clamp(dt * 10);
      trackHands(pose, ex.hands ?? [], dt);
      const [hl, hr] = anim.hand;
      const rRaise = Math.max(anim.cheer, anim.paw);
      const wave = Math.sin(t * 9) * 0.06;
      const armL = hl.vis > anim.cheer
        ? { hand: true, target: [hl.x, hl.y] as V, k: hl.vis, wave: 0, front: overBody([hl.x, hl.y]) }
        : { hand: false, target: geo.ARM_L.end as V, k: anim.cheer, wave: -wave * anim.cheer, front: false };
      const armR = hr.vis > rRaise
        ? { hand: true, target: [hr.x, hr.y] as V, k: hr.vis, wave: 0, front: overBody([hr.x, hr.y]) }
        : { hand: false, target: geo.ARM_R.end as V, k: rRaise, wave: wave * Math.max(anim.cheer, anim.paw * 2), front: false };

      // birds: aim each wing (shoulder → tip) at the same target the arm would reach for
      const wingTurns = new Map<number, Turn>();
      if (def.wings) {
        const w = def.wings;
        const cheerUp: [V, V] = [[w.pivot[0][0] - 220, w.pivot[0][1] - 420], [w.pivot[1][0] + 220, w.pivot[1][1] - 420]];
        [armL, armR].forEach((a, side) => {
          const [px, py] = w.pivot[side];
          const target = a.hand ? a.target : cheerUp[side];
          const rest = Math.atan2(w.tip[side][1] - py, w.tip[side][0] - px);
          const want = Math.atan2(target[1] - py, target[0] - px);
          wingTurns.set(w.idx[side], { pivot: w.pivot[side], angle: turnTo(rest, want) * a.k + a.wave * 2 });
        });
        armL.k = armR.k = 0; // no rubber-hose arms
      }

      // features slide a little with head turn / nod
      const fx = (pose.yaw * 0.25) / FIT, fy = (pose.pitch * 0.35) / FIT;

      inFace(ctx, pose, pose.center, () => {
        ctx.scale(FIT, FIT);
        ctx.translate(-BODY_CENTER.x, -BODY_CENTER.y);

        for (const pass of ["outline", "fill"] as const) {
          // back to front, like the sheet: arms, back parts, body, front parts, face
          if (!armL.front) arm(ctx, pass, geo, geo.ARM_L, armL.target, armL.k, armL.wave);
          if (!armR.front) arm(ctx, pass, geo, geo.ARM_R, armR.target, armR.k, armR.wave);
          layer(ctx, pass, "back", geo.BACK, f);
          ctx.fillStyle = pass === "outline" ? WHITE : geo.MAIN;
          ctx.fill(bodyPath);
          if (pass === "outline") {
            ctx.lineWidth = OUTLINE;
            ctx.lineJoin = "round";
            ctx.strokeStyle = WHITE;
            ctx.stroke(bodyPath);
          }
          layer(ctx, pass, "front", geo.FRONT, f, wingTurns);
          ctx.save();
          ctx.translate(fx, fy);
          def.face(ctx, pass, kit, f);
          ctx.restore();
        }

        // a hand held in front of you → that paw comes in front of the body (and face)
        for (const pass of ["outline", "fill"] as const) {
          if (armL.front) arm(ctx, pass, geo, geo.ARM_L, armL.target, armL.k, 0);
          if (armR.front) arm(ctx, pass, geo, geo.ARM_R, armR.target, armR.k, 0);
        }
      });
    },
  };
}
