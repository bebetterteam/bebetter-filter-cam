import type { Blendshapes } from "../tracker";

export type Mood = "neutral" | "happy" | "surprised" | "angry" | "sad" | "sleepy";
type Scored = Exclude<Mood, "neutral" | "sleepy">;

const THRESHOLD: Record<Scored, number> = { happy: 0.45, surprised: 0.5, angry: 0.45, sad: 0.35 };

/** Smooths blendshapes and classifies a mood, with hysteresis so it doesn't flicker. */
export class Emotion {
  /** EMA-smoothed blendshapes — nicer for driving a character than the raw jittery scores. */
  smooth: Blendshapes = {};
  mood: Mood = "neutral";
  level = 0;
  private closedSince: number | null = null;

  update(bs: Blendshapes | null, t: number, dt: number) {
    const a = 1 - Math.exp(-dt * 18);
    // mouth keys follow faster so quick syllables still reach the character's lips
    const am = 1 - Math.exp(-dt * 35);
    if (bs) {
      for (const [k, v] of Object.entries(bs)) {
        const prev = this.smooth[k] ?? v;
        this.smooth[k] = prev + (v - prev) * (k.startsWith("mouth") || k.startsWith("jaw") ? am : a);
      }
    } else {
      for (const k of Object.keys(this.smooth)) this.smooth[k] *= 1 - a;
    }
    this.level = Math.min(1, this.level + dt * 5);
    this.setMood(bs ? this.classify(bs, t) : "neutral");
  }

  private classify(raw: Blendshapes, t: number): Mood {
    const g = (k: string) => this.smooth[k] ?? 0;
    const avg = (k: string) => (g(k + "Left") + g(k + "Right")) / 2;

    const closed = (raw.eyeBlinkLeft ?? 0) > 0.6 && (raw.eyeBlinkRight ?? 0) > 0.6;
    this.closedSince = closed ? this.closedSince ?? t : null;
    if (this.closedSince !== null && t - this.closedSince > 1.5) return "sleepy";

    const smile = avg("mouthSmile");
    const scores: Record<Scored, number> = {
      happy: smile,
      surprised: g("jawOpen") > 0.3
        ? g("jawOpen") * 0.5 + Math.max(g("browInnerUp"), avg("browOuterUp")) * 0.5 + avg("eyeWide") * 0.3
        : 0,
      // furrowed brows with a smile is determination, not anger
      angry: smile < 0.3 ? avg("browDown") * 0.8 + Math.max(avg("noseSneer"), avg("mouthPress")) * 0.4 : 0,
      sad: smile < 0.2 ? avg("mouthFrown") * 0.7 + g("browInnerUp") * 0.4 : 0,
    };

    const cur = this.mood as Scored;
    if (cur in THRESHOLD && scores[cur] > THRESHOLD[cur] * 0.7) return cur; // hysteresis
    let best: Mood = "neutral", bestRatio = 1;
    for (const m of Object.keys(THRESHOLD) as Scored[]) {
      const r = scores[m] / THRESHOLD[m];
      if (r >= bestRatio) { best = m; bestRatio = r; }
    }
    return best;
  }

  private setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    this.level = 0;
  }
}
