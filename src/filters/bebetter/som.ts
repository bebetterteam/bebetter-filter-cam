import { Particles } from "../../effects/particles";
import { geometry } from "./som-geometry";
import { bebetter, clamp, INK, strokeLine, WHITE, type FaceKit, type FaceState, type LidStyle } from "./rig";

// Som — หมา · DOG. "พลังเยอะ ลองก่อนคิด ตัวทำพัง โดนสถานการณ์เล่นงาน" (public/ref/BeBetter_sheet_Som.svg)
// Face features are the sheet's 10 EXPRESSIONS cells, in small units (eye midpoint = 0,0).

const NO_LID: LidStyle = { top: 0, max: 0, halfW: 0, line: false }; // Som's sheet has no eyelids
const [BX0, BY0, BX1, BY1] = geometry.BODY_BOX;
const BODY_H = BY1 - BY0;


// ── bright special moves (gesture stickers "yay" and "goforit")
const YAY_LEN = 1.2; // s — one bounce cycle
const CONFETTI = ["#FFD23F", "#4360FF", "#BDFF5C", "#FFFFFF", "#FF7FA3", "#B8380F"];
const SPARKS = ["#FFD23F", "#FFB000", "#FF7A1A"];
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];

function feelings(f: FaceState) {
  const { g } = f;
  const browDown = (g("browDownLeft") + g("browDownRight")) / 2;
  const browUp = Math.max(g("browInnerUp"), (g("browOuterUpLeft") + g("browOuterUpRight")) / 2);
  const yay = f.gesture?.id === "yay";
  const go = f.gesture?.id === "goforit";
  const determined = go || (browDown > 0.4 && f.smile > 0.35);
  const excited = yay || f.smile > 0.55;
  const sad = f.mood === "sad";
  const worried = !sad && !excited && !determined && f.smile < 0.2 && browUp > 0.45;
  const shout = f.jaw > 0.4;
  const confused = worried && f.jaw > 0.08 && !shout; // งง: worried + mouth hanging open a bit
  const wow = !shout && !confused && f.jaw > 0.15;
  return { yay, go, determined, excited, sad, worried, confused, shout, wow };
}


/** The sheet's กระโดด (stretch) / ยุบตัว (squash) poses as one bounce: crouch → hop → land → little hop. */
function bounce(u: number): { sx: number; sy: number; dy: number } {
  const H = BODY_H * 0.35;
  if (u < 0.15) { // crouch
    const k = Math.sin((u / 0.15) * Math.PI / 2);
    return { sx: 1 + 0.12 * k, sy: 1 - 0.15 * k, dy: 0 };
  }
  if (u < 0.55) { // big hop: stretched at take-off and landing, round at the top
    const p = (u - 0.15) / 0.4, arc = 4 * p * (1 - p), st = 0.12 * (1 - arc);
    return { sx: 1 - st * 0.7, sy: 1 + st, dy: -arc * H };
  }
  if (u < 0.7) { // land
    const q = Math.sin(((u - 0.55) / 0.15) * Math.PI);
    return { sx: 1 + 0.14 * q, sy: 1 - 0.16 * q, dy: 0 };
  }
  if (u < 1) { // little extra hop — too much energy
    const p = (u - 0.7) / 0.3;
    return { sx: 1, sy: 1, dy: -4 * p * (1 - p) * H * 0.35 };
  }
  return { sx: 1, sy: 1, dy: 0 };
}

function sweat(ctx: CanvasRenderingContext2D, kit: FaceKit, t: number) {
  const { X, Y, S } = kit;
  const slide = ((t * 0.5) % 1) * 8; // the drop slowly slides down
  ctx.save();
  ctx.translate(0, slide * S);
  ctx.beginPath();
  ctx.moveTo(X(82), Y(-60));
  ctx.quadraticCurveTo(X(100), Y(-30), X(96), Y(-20));
  ctx.bezierCurveTo(X(96), Y(-12.3), X(89.7), Y(-6), X(82), Y(-6));
  ctx.bezierCurveTo(X(74.3), Y(-6), X(68), Y(-12.3), X(68), Y(-20));
  ctx.quadraticCurveTo(X(64), Y(-30), X(82), Y(-60));
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.lineWidth = 2 * S; // thin shade edge so it still reads over a light background
  ctx.strokeStyle = kit.geo.SHADE;
  ctx.stroke();
  ctx.restore();
}

/** One Som — each instance has its own ears/tail mood and particles (the move guide draws extra ones). */
export function makeSom() {
  // ears + tail by mood: energy = excited / yay, droop = sad / worried. Smoothed so they ease.
  const mood = { energy: 0, droop: 0, t: 0 };
  const fx = new Particles();
  const fxState = { t: 0, yayStart: -1, nextSpark: 0 };

  function updateMood(f: FaceState) {
    const dt = clamp(f.t - mood.t, 0, 0.1);
    if (dt === 0) return; // face() runs twice per frame (outline + fill)
    mood.t = f.t;
    const e = feelings(f);
    const energy = e.yay ? 1 : e.excited || e.go ? 0.8 : f.mood === "happy" ? 0.5 : 0;
    const droop = e.sad || e.worried || e.confused || f.mood === "sleepy" ? 1 : 0;
    const k = clamp(dt * 6);
    mood.energy += (energy - mood.energy) * k;
    mood.droop += (droop - mood.droop) * k;
  }

  return bebetter({
    id: "som",
    label: "ส้ม",
    geo: geometry,
    anchors: { mouth: [6, 48], cheekX: 40, cheekY: 30 },
    specials: ["yay", "goforit"],
    parts: [
      // short tail: wags; spins like a propeller when excited, hangs low when sad
      { layer: "back", idx: [0], pivot: [845, 1350],
        angle: (f) => mood.droop * 0.7
          + Math.sin(f.t * (4 + mood.energy * 30)) * (0.12 + mood.energy * 0.35) * (1 - 0.8 * mood.droop) },
      // floppy ears (in front of the body): flip up and flap when excited, droop in when sad
      { layer: "front", idx: [0], pivot: [405, 850],
        angle: (f) => mood.energy * 0.4 + Math.sin(f.t * 16) * 0.16 * mood.energy - mood.droop * 0.22 },
      { layer: "front", idx: [1], pivot: [692, 850],
        angle: (f) => -(mood.energy * 0.4 + Math.sin(f.t * 16 + 0.6) * 0.16 * mood.energy - mood.droop * 0.22) },
    ],

    body(f) {
      if (f.gesture?.id === "yay") return bounce(f.gesture.age / YAY_LEN);
      // ลุยเลย: buzzing with energy
      if (f.gesture?.id === "goforit") return { sx: 1, sy: 1 + Math.sin(f.t * 30) * 0.015, dy: 0 };
      return { sx: 1, sy: 1, dy: 0 };
    },

    overlay(ctx, _kit, f) {
      const dt = clamp(f.t - fxState.t, 0, 0.1);
      fxState.t = f.t;
      const gid = f.gesture?.id;
      // 🎉 confetti burst from both sides when a yay starts
      if (gid === "yay") {
        const start = f.t - f.gesture!.age;
        if (Math.abs(start - fxState.yayStart) > 0.05) {
          fxState.yayStart = start;
          for (let i = 0; i < 46; i++) {
            const side = i % 2 ? 1 : -1;
            fx.spawn("confetti", side > 0 ? BX1 - 40 : BX0 + 40, BY0 + BODY_H * 0.45, {
              vx: side * rand(150, 650), vy: -rand(650, 1250), gravity: 1500,
              size: rand(34, 60), rot: rand(0, 6), vr: rand(-12, 12),
              maxLife: rand(1.3, 2), color: pick(CONFETTI),
            });
          }
        }
      }
      // 🔥 energy sparks rising around the body while "ลุยเลย!"
      if (gid === "goforit" && f.t >= fxState.nextSpark) {
        fxState.nextSpark = f.t + 0.045;
        const side = Math.random() < 0.5 ? -1 : 1;
        fx.spawn(Math.random() < 0.6 ? "sparkle" : "star",
          side > 0 ? rand(BX1 - 80, BX1 + 40) : rand(BX0 - 40, BX0 + 80), rand(BY0 + BODY_H * 0.3, BY1), {
            vx: rand(-40, 40), vy: -rand(250, 450), gravity: -300,
            size: rand(38, 70), rot: rand(0, 1), vr: rand(-4, 4), maxLife: rand(0.6, 1), color: pick(SPARKS),
          });
      }
      fx.update(dt);
      fx.draw(ctx);
    },

    face(ctx, pass, kit, f) {
      const { g } = f;
      const { X, Y, S } = kit;
      const shade = kit.geo.SHADE;
      const e = feelings(f);
      const closed = (blink: number) => f.mood === "sleepy" || blink > 0.65;
      const wide = e.wow || e.shout ? 1 : clamp((g("eyeWideLeft") + g("eyeWideRight")) / 2 * 1.5 - 0.3);
      // bliss / ฟิน: the sheet's closed-eye arc, nudged down 10 so it reads on the head, not its edge
      const arc = (cx: number) => {
        const dy = 10;
        ctx.beginPath();
        ctx.moveTo(X(cx - 13.5), Y(-0.9 + dy));
        ctx.bezierCurveTo(X(cx - 10.9), Y(-6 + dy), X(cx - 5.7), Y(-9.2 + dy), X(cx), Y(-9.2 + dy));
        ctx.bezierCurveTo(X(cx + 5.7), Y(-9.2 + dy), X(cx + 10.9), Y(-6 + dy), X(cx + 13.5), Y(-0.9 + dy));
        strokeLine(ctx, "fill", shade, 8 * S, "round");
      };
      // image-left eye is the subject's right eye
      kit.eye(ctx, pass, -1, { lid: 0, closed: closed(g("eyeBlinkRight")), wide }, NO_LID, arc);
      kit.eye(ctx, pass, 1, { lid: 0, closed: closed(g("eyeBlinkLeft")), wide }, NO_LID, arc);
      if (pass === "outline") return;
      updateMood(f);

      // brows, in the sheet's priority: มุ่งมั่น > เศร้า > worry/งง > excited/ฟิน
      if (e.determined) kit.brows(ctx, { angry: 1 });
      else if (e.sad) kit.brows(ctx, { sad: f.level });
      else if (e.worried || e.confused) {
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(X(s * 30), Y(-28));
          ctx.lineTo(X(s * 8), Y(-38));
          strokeLine(ctx, "fill", shade, 7 * S, "round");
        }
      } else if (e.excited) kit.brows(ctx, { curious: 1 });
      else if (f.mood === "angry") kit.brows(ctx, { angry: f.level });

      // big dog nose
      ctx.beginPath();
      ctx.ellipse(X(2), Y(24), 14 * S, 10 * S, 0, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();

      // mouth
      const frown = () => {
        ctx.beginPath();
        ctx.moveTo(X(-10), Y(52));
        ctx.quadraticCurveTo(X(6), Y(42), X(22), Y(52));
        strokeLine(ctx, "fill", shade, 8 * S, "round");
      };
      if (e.shout) kit.shout(ctx, [6, 54]);
      else if (e.confused) {
        frown();
        ctx.beginPath();
        ctx.ellipse(X(6), Y(52), 12 * S, 15 * S, 0, 0, Math.PI * 2);
        ctx.fillStyle = INK;
        ctx.fill();
      } else if (e.wow) {
        ctx.beginPath();
        ctx.ellipse(X(6), Y(48), 10 * S, 13 * S, 0, 0, Math.PI * 2);
        ctx.fillStyle = shade;
        ctx.fill();
      } else if (e.sad || e.worried || f.mood === "angry") frown();
      else {
        // the default wide grin (happy / excited / ฟิน / มุ่งมั่น)
        ctx.beginPath();
        ctx.moveTo(X(-22), Y(36));
        ctx.quadraticCurveTo(X(6), Y(78), X(36), Y(34));
        ctx.quadraticCurveTo(X(6), Y(48), X(-22), Y(36));
        ctx.fillStyle = shade;
        ctx.fill();
      }

      if (e.worried || e.confused) sweat(ctx, kit, f.t);
    },
  });
}

export const som = makeSom();
