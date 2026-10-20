import type { Pose, Pt } from "../anchor";
import type { Blendshapes } from "../tracker";
import { Particles } from "./particles";

const HEART_COLORS = ["#ff7fa3", "#ff5c8a", "#ffa3c4", "#ff8fb1"];
const SPARKLE_COLORS = ["#fff6a8", "#ffffff", "#ffd6f0", "#c9f1ff"];
const STAR_COLORS = ["#ffd84d", "#ffe98a", "#ffc2e2"];

const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** Turns blendshape scores into particle effects, with hysteresis + cooldowns to avoid flicker. */
export class Effects {
  readonly particles = new Particles();
  private blush = 0;
  private mouthOpen = false;
  private nextHeart = 0;
  private eyesClosedSince: number | null = null;
  private blinkFired = false;
  private nextStar = 0;

  update(pose: Pose | null, bs: Blendshapes, t: number, dt: number, baseBlush = 0.25) {
    this.particles.update(dt);
    const smile = ((bs.mouthSmileLeft ?? 0) + (bs.mouthSmileRight ?? 0)) / 2;
    this.blush += ((pose ? baseBlush + Math.max(0, smile - 0.3) * 1.2 : 0) - this.blush) * Math.min(1, dt * 6);
    if (!pose) {
      this.mouthOpen = false;
      this.eyesClosedSince = null;
      return;
    }
    const s = pose.size;

    // 💕 open mouth → stream of hearts
    const jaw = bs.jawOpen ?? 0;
    if (!this.mouthOpen && jaw > 0.5) this.mouthOpen = true;
    else if (this.mouthOpen && jaw < 0.35) this.mouthOpen = false;
    if (this.mouthOpen && t >= this.nextHeart) {
      this.nextHeart = t + 0.09;
      const m = mid(pose.mouthTop, pose.mouthBottom);
      this.particles.spawn("heart", m.x + rand(-0.05, 0.05) * s, m.y, {
        vx: rand(-60, 60), vy: rand(-260, -160),
        size: rand(0.07, 0.13) * s, rot: rand(-0.3, 0.3), vr: rand(-1, 1),
        maxLife: rand(1.2, 1.8), color: pick(HEART_COLORS),
      });
    }

    // ✨ deliberate blink (both eyes closed ≥ 0.18s) → sparkle burst. Normal blinks are shorter.
    const closed = (bs.eyeBlinkLeft ?? 0) > 0.55 && (bs.eyeBlinkRight ?? 0) > 0.55;
    if (closed) {
      this.eyesClosedSince ??= t;
      if (!this.blinkFired && t - this.eyesClosedSince > 0.18) {
        this.blinkFired = true;
        for (const eye of [pose.leftEye, pose.rightEye]) this.burst(eye, s);
      }
    } else if ((bs.eyeBlinkLeft ?? 0) < 0.35 && (bs.eyeBlinkRight ?? 0) < 0.35) {
      this.eyesClosedSince = null;
      this.blinkFired = false;
    }

    // ⭐ raised eyebrows → stars twinkle above the head
    if ((bs.browInnerUp ?? 0) > 0.6 && t >= this.nextStar) {
      this.nextStar = t + 0.12;
      const up = { x: Math.sin(pose.roll), y: -Math.cos(pose.roll) };
      const side = rand(-0.5, 0.5);
      const base = {
        x: pose.forehead.x + (up.x * 0.25 + Math.cos(pose.roll) * side) * s,
        y: pose.forehead.y + (up.y * 0.25 + Math.sin(pose.roll) * side) * s,
      };
      this.particles.spawn("star", base.x, base.y, {
        vx: up.x * 80 + rand(-30, 30), vy: up.y * 80 + rand(-30, 30),
        size: rand(0.06, 0.11) * s, vr: rand(-3, 3), maxLife: rand(0.8, 1.2), color: pick(STAR_COLORS),
      });
    }
  }

  private burst(at: Pt, s: number) {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(120, 320) * (s / 300);
      this.particles.spawn("sparkle", at.x, at.y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        size: rand(0.04, 0.09) * s, rot: rand(0, 1), vr: rand(-4, 4),
        maxLife: rand(0.6, 1.0), color: pick(SPARKLE_COLORS),
      });
    }
  }

  /** 🌸 cheek blush; grows when smiling. Drawn under the filter. */
  drawBlush(ctx: CanvasRenderingContext2D, pose: Pose | null) {
    if (!pose || this.blush < 0.01) return;
    const r = pose.size * 0.13;
    for (const c of [pose.leftCheek, pose.rightCheek]) {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, `rgba(255, 120, 160, ${0.55 * Math.min(1, this.blush)})`);
      g.addColorStop(1, "rgba(255, 120, 160, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, r, r * 0.7, pose.roll, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.particles.draw(ctx);
  }
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
