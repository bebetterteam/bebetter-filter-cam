export type Kind = "heart" | "sparkle" | "star";

interface Particle {
  kind: Kind;
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  rot: number; vr: number;
  life: number; maxLife: number;
  color: string;
}

const MAX = 300;

export class Particles {
  private list: Particle[] = [];

  spawn(kind: Kind, x: number, y: number, opts: Partial<Particle> = {}) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      kind, x, y,
      vx: 0, vy: 0, size: 20, rot: 0, vr: 0,
      life: 0, maxLife: 1.4, color: "#ff7fa3",
      ...opts,
    });
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === "heart") p.vx += Math.sin(p.life * 6 + p.size) * 30 * dt; // gentle wobble
      else { p.vx *= 0.94; p.vy *= 0.94; }
    }
    this.list = this.list.filter((p) => p.life < p.maxLife);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const k = p.life / p.maxLife;
      const pop = Math.min(1, p.life / 0.15); // scale-in
      ctx.save();
      ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(p.size * pop, p.size * pop);
      ctx.fillStyle = p.color;
      SHAPES[p.kind](ctx);
      ctx.restore();
    }
  }
}

const SHAPES: Record<Kind, (ctx: CanvasRenderingContext2D) => void> = {
  heart(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 0.35);
    ctx.bezierCurveTo(-0.9, -0.25, -0.45, -0.95, 0, -0.45);
    ctx.bezierCurveTo(0.45, -0.95, 0.9, -0.25, 0, 0.35);
    ctx.fill();
    ctx.lineWidth = 0.08;
    ctx.strokeStyle = "#ffffffcc";
    ctx.stroke();
  },
  sparkle(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 0.13 : 0.6;
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  },
  star(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.22 : 0.55;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.12;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();
    ctx.fill();
  },
};
