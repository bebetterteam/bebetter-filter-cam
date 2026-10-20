import { geometry } from "./manow-geometry";
import { bebetter, clamp, INK, strokeLine, TONGUE, type FaceKit, type LidStyle } from "./rig";

// Manow — นกแก้ว · PARROT. "ช่างสังเกต ช่างสงสัย ถามคำถามที่คนดูคิด" (public/ref/BeBetter_sheet_Manow.svg)

const LID: LidStyle = { top: -24.7, max: -8.6, halfW: 22.8, line: false };

const MOUTH_INSIDE = "#7A1F2E";
const BEAK_SHINE = "#4A4A4A";

// wings (FRONT prims 0/1): shoulder pivot near the top end, tip = the far end of the ellipse
const WING_PIVOT: [[number, number], [number, number]] = [[290, 1060], [830, 1060]];
const WING_TIP: [[number, number], [number, number]] = [[396.9, 1311.5], [723.2, 1311.5]];

/**
 * Hooked parrot beak (the sheet's beak is a flat-topped block that reads oddly on camera, so this
 * is a redraw in the same style). `open` 0…1: the lower mandible drops and the mouth shows.
 * Small units, centered under the eyes.
 */
function beak(ctx: CanvasRenderingContext2D, kit: FaceKit, open: number) {
  const { X, Y, S } = kit;
  const o = open * 26; // how far the lower mandible drops (small units)
  ctx.save();
  // a touch bigger than the eyes' gap, like the sheet's chunky beak
  ctx.translate(X(2), Y(10));
  ctx.scale(1.2, 1.2);
  ctx.translate(-X(2), -Y(10));

  // mouth inside + tongue, revealed between the hook and the dropping mandible
  if (o > 0.5) {
    ctx.beginPath();
    ctx.ellipse(X(1), Y(36 + o * 0.55), 12 * S, (2 + o * 0.55) * S, 0, 0, Math.PI * 2);
    ctx.fillStyle = MOUTH_INSIDE;
    ctx.fill();
    ctx.save();
    ctx.clip(); // tongue stays inside the mouth
    ctx.beginPath();
    ctx.ellipse(X(1), Y(37 + o * 0.85), 7.5 * S, (1.5 + o * 0.28) * S, 0, 0, Math.PI * 2);
    ctx.fillStyle = TONGUE;
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = INK;
  // lower mandible: a rounded scoop under the hook, drops with the jaw
  ctx.beginPath();
  ctx.moveTo(X(-12), Y(33 + o * 0.7));
  ctx.bezierCurveTo(X(-12), Y(45 + o), X(11), Y(46 + o), X(13), Y(34 + o * 0.7));
  ctx.quadraticCurveTo(X(1), Y(39 + o * 0.85), X(-12), Y(33 + o * 0.7));
  ctx.fill();
  // upper beak: rounded top, curving down into a short hook whose tip leans right (like the sheet)
  ctx.beginPath();
  ctx.moveTo(X(-15), Y(15));
  ctx.bezierCurveTo(X(-15), Y(3), X(19), Y(3), X(19), Y(15));
  ctx.bezierCurveTo(X(19), Y(29), X(14), Y(41), X(6), Y(50));
  ctx.bezierCurveTo(X(6.5), Y(43), X(3), Y(38), X(-3), Y(36));
  ctx.bezierCurveTo(X(-11), Y(34), X(-15), Y(27), X(-15), Y(15));
  ctx.closePath();
  ctx.fill();
  // a soft shine so it reads as a 3D hook, not a flat blob
  ctx.beginPath();
  ctx.moveTo(X(-9), Y(12));
  ctx.quadraticCurveTo(X(-11), Y(21), X(-7), Y(29));
  strokeLine(ctx, "fill", BEAK_SHINE, 2.4 * S, "round");
  ctx.restore();
}

export const manow = bebetter({
  id: "manow",
  icon: "🦜",
  label: "มะนาว",
  geo: geometry,
  anchors: { mouth: [4, 50], cheekX: 38, cheekY: 26 },
  parts: [
    // tail feathers wag
    { layer: "back", idx: [0, 1], pivot: [740, 1390],
      angle: (f) => Math.sin(f.t * (1.8 + (f.mood === "happy" ? f.level * 4 : 0))) * 0.08 },
    // the 3 crest feathers sway; perk up when surprised / curious
    { layer: "back", idx: [2, 3, 4], pivot: [543.5, 830],
      angle: (f) => Math.sin(f.t * 1.3) * 0.03 + (f.mood === "surprised" ? Math.sin(f.t * 20) * 0.03 * f.level : 0) },
    // wings flap when happy
    { layer: "front", idx: [0], pivot: WING_PIVOT[0], angle: (f) => (f.mood === "happy" ? Math.sin(f.t * 12) * 0.12 * f.level : 0) },
    { layer: "front", idx: [1], pivot: WING_PIVOT[1], angle: (f) => (f.mood === "happy" ? -Math.sin(f.t * 12) * 0.12 * f.level : 0) },
  ],
  // a parrot raises its wings (not paws) to follow your hands
  wings: { idx: [0, 1], pivot: WING_PIVOT, tip: WING_TIP },

  face(ctx, pass, kit, f) {
    const { g, mood, level } = f;
    const { X, Y, S } = kit;
    const sl = g("mouthSmileLeft"), sr = g("mouthSmileRight");

    // ตาหยี (laugh): big smile closes the eyes into ^ ^
    const laugh = f.smile > 0.55;
    const smug = Math.abs(sl - sr) > 0.22 && Math.max(sl, sr) > 0.3;
    // เหล่มอง (side-eye): looking hard to one side → half lids + eyes slide that way
    const sideEye = Math.abs(f.gx) > 0.55;
    const dx = sideEye ? 4.2 * Math.sign(f.gx) : 0;
    const lidFor = (blink: number) =>
      Math.max(clamp((blink - 0.2) / 0.4), smug || sideEye ? 1 : 0, mood === "angry" ? level : 0);
    const sleepy = mood === "sleepy";
    const chevron = (cx: number) => {
      ctx.beginPath();
      ctx.moveTo(X(cx - 15), Y(6));
      ctx.lineTo(X(cx), Y(-9));
      ctx.lineTo(X(cx + 15), Y(6));
      strokeLine(ctx, "fill", INK, 8 * S, "round");
    };
    // image-left eye is the subject's right eye
    kit.eye(ctx, pass, -1, { lid: lidFor(g("eyeBlinkRight")), closed: laugh || sleepy || g("eyeBlinkRight") > 0.65, dx }, LID, chevron);
    kit.eye(ctx, pass, 1, { lid: lidFor(g("eyeBlinkLeft")), closed: laugh || sleepy || g("eyeBlinkLeft") > 0.65, dx }, LID, chevron);
    if (pass === "outline") return;

    // สงสัย (curious): brows up without being sad/angry — Manow's signature look
    const browUp = Math.max(g("browInnerUp"), (g("browOuterUpLeft") + g("browOuterUpRight")) / 2);
    const curious = mood === "sad" || mood === "angry" ? 0 : clamp((browUp - 0.35) / 0.3);
    kit.brows(ctx, { angry: mood === "angry" ? level : 0, sad: mood === "sad" ? level : 0, curious });

    // beak opens with your jaw (a little when curious); ตะโกน = wide open
    const bx = sideEye ? 2.2 * Math.sign(f.gx) : 0;
    const open = Math.max(clamp(f.jaw / 0.45), curious * 0.35);
    ctx.save();
    ctx.translate(bx * S, 0);
    beak(ctx, kit, open);
    ctx.restore();
  },
});
