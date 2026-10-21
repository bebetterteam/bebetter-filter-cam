import { geometry } from "./bee-geometry";
import { bebetter, clamp, strokeLine, type FaceKit, type LidStyle } from "./rig";

// Bee — แมว · CAT. "นิ่ง หน้าตาย พูดน้อย" (public/ref/BeBetter_sheet_Bee.svg)

const LID: LidStyle = { top: -25.65, max: -2.85, halfW: 23.75, line: true };

type MouthShape = "calm" | "happy" | "smirk" | "alert" | "shout";

function pickMouth(g: (k: string) => number): { kind: MouthShape; flip: boolean } {
  const jaw = g("jawOpen");
  const sl = g("mouthSmileLeft"), sr = g("mouthSmileRight"); // subject's left = image right
  if (jaw > 0.38) return { kind: "shout", flip: false };
  if (jaw > 0.15) return { kind: "alert", flip: false };
  if (Math.abs(sl - sr) > 0.22 && Math.max(sl, sr) > 0.3) return { kind: "smirk", flip: sr > sl };
  if ((sl + sr) / 2 > 0.4) return { kind: "happy", flip: false };
  return { kind: "calm", flip: false };
}

function mouth(ctx: CanvasRenderingContext2D, kit: FaceKit, kind: MouthShape, flip: boolean) {
  const { X, Y, S } = kit;
  const shade = kit.geo.SHADE;
  ctx.save();
  if (flip) {
    // smirk toward the other side: mirror around the mouth's own center
    ctx.translate(X(12), 0);
    ctx.scale(-1, 1);
    ctx.translate(-X(12), 0);
  }
  ctx.fillStyle = shade;
  switch (kind) {
    case "calm":
      ctx.beginPath();
      ctx.moveTo(X(-6), Y(38));
      ctx.quadraticCurveTo(X(10), Y(50), X(28), Y(36));
      strokeLine(ctx, "fill", shade, 8 * S, "round");
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
      strokeLine(ctx, "fill", shade, 9 * S, "round");
      ctx.beginPath();
      ctx.moveTo(X(30), Y(20));
      ctx.quadraticCurveTo(X(40), Y(28), X(36), Y(36));
      strokeLine(ctx, "fill", shade, 6 * S, "round");
      break;
    case "alert":
      ctx.beginPath();
      ctx.ellipse(X(8), Y(40), 6 * S, 8 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "shout":
      kit.shout(ctx, [8, 52]);
      break;
  }
  ctx.restore();
}

/** A Bee instance (the move guide draws its own so it never disturbs the live one). */
export function makeBee() {
  return bebetter({
    id: "bee",
    label: "บี",
    geo: geometry,
    anchors: { mouth: [8, 40], cheekX: 38, cheekY: 30 },
    parts: [
      // tail + its 3 stripes wag around the tail's base
      { layer: "back", idx: [0, 1, 2, 3], pivot: [822.2, 1344.6],
        angle: (f) => Math.sin(f.t * (1.6 + (f.mood === "happy" ? f.level * 3 : 0))) * 0.07 },
      // left ear twitches now and then
      { layer: "back", idx: [4, 5], pivot: [428.9, 840.15],
        angle: (f) => -Math.max(0, Math.sin(f.t * 0.7) - 0.96) * 0.9 },
    ],

    face(ctx, pass, kit, f) {
      const { g, mood, level } = f;
      const { X, Y, S } = kit;
      const { kind, flip } = pickMouth(g);
      const lidFor = (blink: number) => {
        let lid = clamp((blink - 0.2) / 0.4);
        if (mood === "sad") lid = Math.max(lid, level);
        if (kind === "smirk") lid = 1;
        return lid;
      };
      const heart = g("mouthPucker") > 0.55 && f.jaw < 0.15;
      const sleepy = mood === "sleepy";
      // bliss: the sheet's closed-eye arc, nudged down 12 units so it reads on the blue head
      // instead of vanishing against the same-colored ears
      const bliss = (cx: number) => {
        const dy = 12;
        ctx.beginPath();
        ctx.moveTo(X(cx - 13.54), Y(-0.9 + dy));
        ctx.bezierCurveTo(X(cx - 10.95), Y(-5.99 + dy), X(cx - 5.72), Y(-9.2 + dy), X(cx), Y(-9.2 + dy));
        ctx.bezierCurveTo(X(cx + 5.72), Y(-9.2 + dy), X(cx + 10.95), Y(-5.99 + dy), X(cx + 13.54), Y(-0.9 + dy));
        strokeLine(ctx, "fill", kit.geo.SHADE, 7 * S, "round");
      };
      // image-left eye is the subject's right eye
      kit.eye(ctx, pass, -1, { lid: lidFor(g("eyeBlinkRight")), closed: sleepy || g("eyeBlinkRight") > 0.65, heart }, LID, bliss);
      kit.eye(ctx, pass, 1, { lid: lidFor(g("eyeBlinkLeft")), closed: sleepy || g("eyeBlinkLeft") > 0.65, heart }, LID, bliss);
      if (pass === "outline") return;

      kit.brows(ctx, { angry: mood === "angry" ? level : 0, sad: mood === "sad" ? level : 0 });
      // nose
      ctx.beginPath();
      ctx.ellipse(X(2), Y(22), 9 * S, 6 * S, 0, 0, Math.PI * 2);
      ctx.fillStyle = kit.geo.SHADE;
      ctx.fill();
      mouth(ctx, kit, kind, flip);
    },
  });
}

export const bee = makeBee();
