import { geometry } from "./manow-geometry";
import { bebetter, clamp, INK, strokeLine, TONGUE, WHITE, type FaceKit, type FaceState, type LidStyle } from "./rig";

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
// ── crest mood (หงอนบอกอารมณ์): smoothed so the crest eases between poses
// up = spiky (ตกใจ/โกรธ), down = flattened (เศร้า/ง่วง), hook = middle feather bends (สงสัย)
const crest = { up: 0, down: 0, hook: 0, t: 0 };

function updateCrest(f: FaceState, curious: number) {
  const dt = clamp(f.t - crest.t, 0, 0.1);
  if (dt === 0) return; // face() runs twice per frame (outline + fill)
  crest.t = f.t;
  const k = clamp(dt * 8);
  const up = f.mood === "surprised" || f.mood === "angry" ? 1 : 0;
  const down = f.mood === "sad" || f.mood === "sleepy" ? 1 : 0;
  crest.up += (up - crest.up) * k;
  crest.down += (down - crest.down) * k;
  crest.hook += (curious - crest.hook) * k;
}

const sway = (f: FaceState) =>
  Math.sin(f.t * 1.3) * 0.03 * (1 - crest.down)
  + (f.mood === "surprised" ? Math.sin(f.t * 20) * 0.03 * f.level : 0)
  + (f.gesture?.id === "question" ? Math.sin(f.t * 8) * 0.06 : 0);

/**
 * 🔍 magnifying glass held over Manow's image-right eye while the "observe" sticker is up.
 * Small units; the lens magnifies by drawing that eye bigger inside it.
 */
function magnifier(ctx: CanvasRenderingContext2D, kit: FaceKit, age: number) {
  const { X, Y, S } = kit;
  const pop = easeOutBack(clamp(age / 0.3));
  const fade = clamp((2.2 - age) / 0.3);
  if (fade <= 0) return;
  const cx = 21, cy = -2, r = 25;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(X(cx), Y(cy));
  ctx.rotate(Math.sin(age * 4) * 0.05);
  ctx.scale(pop, pop);
  ctx.translate(-X(cx), -Y(cy));
  // handle
  ctx.beginPath();
  ctx.moveTo(X(cx + r * 0.72), Y(cy + r * 0.72));
  ctx.lineTo(X(cx + r * 1.55), Y(cy + r * 1.6));
  strokeLine(ctx, "fill", WHITE, 13 * S, "round");
  strokeLine(ctx, "fill", "#8A5A2B", 8 * S, "round");
  // lens: the eye behind it, magnified
  ctx.save();
  ctx.beginPath();
  ctx.arc(X(cx), Y(cy), r * S, 0, Math.PI * 2);
  ctx.fillStyle = kit.geo.MAIN;
  ctx.fill();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(X(18), Y(0), 19 * 1.3 * S, 19.95 * 1.3 * S, 0, 0, Math.PI * 2);
  ctx.fillStyle = WHITE;
  ctx.fill();
  const px = 18 + kit.f.gx * 9, py = 1 + kit.f.gy * 6;
  ctx.beginPath();
  ctx.arc(X(px), Y(py), 6.46 * 1.4 * S, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(X(px - 3), Y(py - 3.8), 2.6 * S, 0, Math.PI * 2);
  ctx.fillStyle = WHITE;
  ctx.fill();
  // glassy tint + glint
  ctx.fillStyle = "rgba(200, 235, 255, 0.25)";
  ctx.fillRect(X(cx - r), Y(cy - r), 2 * r * S, 2 * r * S);
  ctx.beginPath();
  ctx.arc(X(cx), Y(cy), r * 0.68 * S, Math.PI * 1.1, Math.PI * 1.45);
  strokeLine(ctx, "fill", "rgba(255,255,255,0.8)", 3.5 * S, "round");
  ctx.restore();
  // rim
  ctx.beginPath();
  ctx.arc(X(cx), Y(cy), r * S, 0, Math.PI * 2);
  strokeLine(ctx, "fill", WHITE, 11 * S, "round");
  strokeLine(ctx, "fill", INK, 6 * S, "round");
  ctx.restore();
}

/** overshoots a little then settles — a "pop" */
function easeOutBack(x: number) {
  const c = 1.70158;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

/**
 * ❓ that pops up above the crest while the "question" sticker is showing.
 * Drawn in FRONT units; un-flipped when the canvas is mirrored so the glyph reads correctly.
 */
function questionMark(ctx: CanvasRenderingContext2D, kit: FaceKit, age: number, mirror: boolean) {
  const { X, Y, S } = kit;
  const pop = easeOutBack(clamp(age / 0.3));
  const fade = clamp((2.2 - age) / 0.3);
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  // up and to the right of the crest, bobbing and tipping like it's thinking
  ctx.translate(X(34), Y(-96 + Math.sin(age * 5) * 2));
  ctx.rotate(0.18 + Math.sin(age * 3.5) * 0.08);
  ctx.scale(pop * S * (mirror ? -1 : 1), pop * S);
  ctx.font = '700 44px Mitr, "Noto Sans Thai", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 15;
  ctx.strokeStyle = "#fff";
  ctx.strokeText("?", 0, 0);
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.strokeText("?", 0, 0);
  ctx.fillStyle = "#FFD23F";
  ctx.fillText("?", 0, 0);
  ctx.restore();
}

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
    // crest feathers (left / middle / right), each pivoting at its base: they sway, spike up
    // when surprised or angry, flatten out when sad or sleepy, and the middle one hooks when curious
    { layer: "back", idx: [2], pivot: [500, 812],
      angle: (f) => sway(f) + crest.up * 0.18 - crest.down * 0.6,
      scale: () => 1 + crest.up * 0.15 - crest.down * 0.25 },
    { layer: "back", idx: [3], pivot: [543.5, 810],
      angle: (f) => sway(f) + crest.hook * 0.45,
      scale: () => 1 + crest.up * 0.2 - crest.down * 0.45 - crest.hook * 0.12 },
    { layer: "back", idx: [4], pivot: [587, 812],
      angle: (f) => sway(f) - crest.up * 0.18 + crest.down * 0.6,
      scale: () => 1 + crest.up * 0.15 - crest.down * 0.25 },
    // wings flap when happy
    { layer: "front", idx: [0], pivot: WING_PIVOT[0], angle: (f) => (f.mood === "happy" ? Math.sin(f.t * 12) * 0.12 * f.level : 0) },
    { layer: "front", idx: [1], pivot: WING_PIVOT[1], angle: (f) => (f.mood === "happy" ? -Math.sin(f.t * 12) * 0.12 * f.level : 0) },
  ],
  // a parrot raises its wings (not paws) to follow your hands
  wings: { idx: [0, 1], pivot: WING_PIVOT, tip: WING_TIP },
  // ช่างสงสัย: brows up + head tilt → ❓ + a random question sticker
  questions: true,
  // ช่างสังเกต: lean in toward the camera → 🔍 magnifying glass + "อืมมม..."
  observes: true,

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
    const observing = f.gesture?.id === "observe";
    const lidFor = (blink: number) =>
      Math.max(clamp((blink - 0.2) / 0.4), smug || sideEye || observing ? 1 : 0, mood === "angry" ? level : 0);
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

    // สงสัย (curious): brows up without being sad/angry — Manow's signature look.
    // While asking a question, stay in the curious face for the whole sticker.
    const asking = f.gesture?.id === "question";
    const browUp = Math.max(g("browInnerUp"), (g("browOuterUpLeft") + g("browOuterUpRight")) / 2);
    const curious = asking ? 1 : mood === "sad" || mood === "angry" ? 0 : clamp((browUp - 0.35) / 0.3);
    updateCrest(f, curious);
    kit.brows(ctx, { angry: mood === "angry" ? level : 0, sad: mood === "sad" ? level : 0, curious });

    // beak opens with your jaw (a little when curious); ตะโกน = wide open
    const bx = sideEye ? 2.2 * Math.sign(f.gx) : 0;
    const open = Math.max(clamp(f.jaw / 0.45), curious * 0.35);
    ctx.save();
    ctx.translate(bx * S, 0);
    beak(ctx, kit, open);
    ctx.restore();

    if (asking) questionMark(ctx, kit, f.gesture!.age, f.mirror);
    if (observing) magnifier(ctx, kit, f.gesture!.age);
  },
});
