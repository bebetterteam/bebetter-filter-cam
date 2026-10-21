import { applyAccent } from "./accent";
import { CAPTIONS, type CaptionId } from "./captions";
import type { Mood } from "./effects/emotion";
import { makeBee } from "./filters/bebetter/bee";
import { makeManow } from "./filters/bebetter/manow";
import { makeSom } from "./filters/bebetter/som";
import type { Filter } from "./filters/types";
import { synthPose } from "./synthPose";
import type { Blendshapes } from "./tracker";

// วิธีเล่นท่า — a slide-over guide where every move is shown by the real character, looping:
// neutral → ease into the move → hold → back. Each card draws its own character instance, so
// nothing here touches the live filter (particles, hand tracking…).

interface Move {
  title: string;
  /** what to do; text in [brackets] becomes a small chip, e.g. "[ค้าง ½ วิ]" */
  steps: string[];
  /** what you get (sticker text, effect) */
  result?: string;
  bs?: Blendshapes;
  mood?: Mood;
  gesture?: CaptionId;
  /** simulated raised palms, in face widths from the face center (y < 0 = up) */
  hands?: [number, number][];
  /** head tilt (rad) / lean toward the camera (size × 1+lean) at full strength */
  roll?: number;
  lean?: number;
}

interface CharGuide {
  id: "bee" | "manow" | "som";
  name: string;
  kind: string;
  tagline: string;
  accent: string;
  make: () => Filter;
  specials: Move[];
  faces: Move[];
}

/** "ป้าย: a / b / c" from the caption table */
function captionText(id: CaptionId) {
  const c = CAPTIONS[id];
  const list = (Array.isArray(c) ? c : [c]).map((x) => x.title + (x.sub ? ` ${x.sub}` : ""));
  return (list.length > 1 ? "ป้ายสุ่ม: " : "ป้าย: ") + list.join(" / ");
}

const HANDS_UP: [number, number][] = [[-1.35, -1.15], [1.35, -1.25]];
const smile = (v: number): Blendshapes => ({ mouthSmileLeft: v, mouthSmileRight: v });
const blink = (v: number): Blendshapes => ({ eyeBlinkLeft: v, eyeBlinkRight: v });

const GUIDES: CharGuide[] = [
  {
    id: "bee", name: "บี", kind: "แมว", accent: "#4360FF", make: makeBee,
    tagline: "นิ่ง หน้าตาย พูดน้อย ตบมุกแบบไม่สะทกสะท้าน",
    specials: [
      { title: "รับทราบ (แต่ไม่รับรอง)", steps: ["พยักหน้าลง-ขึ้นเร็วๆ [1–2 รอบ]"], result: "ยกแขนโบก · " + captionText("nod"), gesture: "nod" },
      { title: "ชูแขนดีใจ", steps: ["ยิ้มกว้างมากๆ ให้เห็นฟัน [ค้างไว้]"], result: "ชูสองแขน หางกระดิกเร็ว", bs: smile(0.9), mood: "happy" },
      { title: "แขนตามมือ", steps: ["ยกมือขึ้นสูงกว่าคาง", "กล้องต้องเห็นมือ"], result: "อุ้งเท้ายืดไปหามือคุณ โบกได้ตามจริง", hands: HANDS_UP },
      { title: "ตาหัวใจ", steps: ["จู๋ปากแบบส่งจูบ [ปากปิด]", "[ค้าง ½ วิ]"], result: "ตากลายเป็นหัวใจสีส้ม", bs: { mouthPucker: 0.85 } },
    ],
    faces: [
      { title: "ยิ้มมุมปาก", steps: ["ยิ้มข้างเดียว"], bs: { mouthSmileLeft: 0.7, mouthSmileRight: 0.1 } },
      { title: "ตาปรือ", steps: ["หรี่ตาครึ่งเดียว"], bs: blink(0.55) },
      { title: "หลับตาฟิน", steps: ["หลับตา + ยิ้ม"], bs: { ...blink(1), ...smile(0.6) }, mood: "happy" },
      { title: "ตกใจ", steps: ["อ้าปากนิดหน่อย"], bs: { jawOpen: 0.25 }, mood: "surprised" },
      { title: "ตะโกน", steps: ["อ้าปากกว้าง"], bs: { jawOpen: 0.8 }, mood: "surprised" },
      { title: "หงุดหงิด", steps: ["ขมวดคิ้ว ไม่ยิ้ม"], bs: { browDownLeft: 0.8, browDownRight: 0.8 }, mood: "angry" },
      { title: "เศร้า", steps: ["ปากคว่ำ คิ้วตก"], bs: { mouthFrownLeft: 0.8, mouthFrownRight: 0.8 }, mood: "sad" },
    ],
  },
  {
    id: "manow", name: "มะนาว", kind: "นกแก้ว", accent: "#BDFF5C", make: makeManow,
    tagline: "ช่างสังเกต ช่างสงสัย ถามคำถามที่คนดูคิด",
    specials: [
      { title: "ถามคำถาม", steps: ["เลิกคิ้ว", "เอียงคอนิดนึง [ค้าง ½ วิ]"], result: "มี ? เด้งเหนือหงอน · " + captionText("question"), bs: { browInnerUp: 0.8 }, roll: 0.25, gesture: "question" },
      { title: "ส่องแว่นขยาย", steps: ["ยื่นหน้าเข้าหากล้อง [เร็วๆ]", "ถอยกลับก่อนเล่นซ้ำ"], result: "ส่องแว่นขยาย หรี่ตาอีกข้าง · " + captionText("observe"), lean: 0.35, gesture: "observe" },
      { title: "ปีกตามมือ", steps: ["ยกมือขึ้นสูงกว่าคาง", "กล้องต้องเห็นมือ"], result: "ปีกข้างนั้นชี้ไปหามือคุณ", hands: HANDS_UP },
      { title: "กางปีกดีใจ", steps: ["ยิ้มกว้างมากๆ [ค้างไว้]"], result: "ตาหยี กางปีกสองข้าง กระพือ", bs: smile(0.9), mood: "happy" },
    ],
    faces: [
      { title: "ตาหยี", steps: ["ยิ้มกว้าง"], bs: smile(0.65), mood: "happy" },
      { title: "smug", steps: ["ยิ้มข้างเดียว"], bs: { mouthSmileLeft: 0.5, mouthSmileRight: 0.1 } },
      { title: "อ้าปาก", steps: ["อ้าปาก (จะงอยปากอ้าตาม)"], bs: { jawOpen: 0.3 } },
      { title: "ตะโกน", steps: ["อ้าปากกว้าง"], bs: { jawOpen: 0.8 }, mood: "surprised" },
      { title: "เหล่มอง", steps: ["เหลือบตาไปข้างหนึ่งแรงๆ"], bs: { eyeLookOutRight: 0.9, eyeLookInLeft: 0.9 } },
      { title: "หงอนชัน", steps: ["ทำหน้าตกใจ หรือโกรธ"], bs: { jawOpen: 0.3 }, mood: "surprised" },
      { title: "หงอนลู่", steps: ["ทำหน้าเศร้า"], bs: { mouthFrownLeft: 0.8, mouthFrownRight: 0.8 }, mood: "sad" },
    ],
  },
  {
    id: "som", name: "ส้ม", kind: "หมา", accent: "#FC6129", make: makeSom,
    tagline: "พลังเยอะ ลองก่อนคิด ตัวทำพัง โดนสถานการณ์เล่นงาน",
    specials: [
      { title: "เย้! เด้งดึ๋ง", steps: ["ยกสองมือ หรือหัวเราะกว้าง", "[ค้าง ⅓ วิ]"], result: "กระโดดยืด-ยุบ ชูแขน พลุกระดาษ · " + captionText("yay"), hands: HANDS_UP, mood: "happy", gesture: "yay" },
      { title: "ลุยเลย!", steps: ["ขมวดคิ้ว + ยิ้ม", "[ค้าง ½ วิ]"], result: "ชูกำปั้น ประกายพลังรอบตัว · " + captionText("goforit"), bs: { browDownLeft: 0.6, browDownRight: 0.6, ...smile(0.5) }, gesture: "goforit" },
      { title: "แขนตามมือ", steps: ["ยกมือขึ้นสูงกว่าคาง", "กล้องต้องเห็นมือ"], result: "อุ้งเท้ายืดไปหามือคุณ", hands: [[1.5, -0.9]] },
    ],
    faces: [
      { title: "ตื่นเต้น", steps: ["ยิ้มกว้าง"], bs: smile(0.7), mood: "happy" },
      { title: "ฟิน", steps: ["หลับตา + ยิ้ม"], bs: { ...blink(1), ...smile(0.7) }, mood: "happy" },
      { title: "wow", steps: ["อ้าปากนิดหน่อย"], bs: { jawOpen: 0.25 }, mood: "surprised" },
      { title: "ตะโกน", steps: ["อ้าปากกว้าง"], bs: { jawOpen: 0.8 }, mood: "surprised" },
      { title: "กังวล", steps: ["เลิกคิ้ว ไม่ยิ้ม"], bs: { browInnerUp: 0.7 } },
      { title: "งง", steps: ["เลิกคิ้ว + อ้าปากนิดๆ"], bs: { browInnerUp: 0.7, jawOpen: 0.1 } },
      { title: "เศร้า", steps: ["ทำหน้าเศร้า (หูตก หางตก)"], bs: { mouthFrownLeft: 0.8, mouthFrownRight: 0.8 }, mood: "sad" },
    ],
  },
];

const BASICS: [string, string][] = [
  ["พยักหน้า", "รับทราบ (แต่ไม่รับรอง)"],
  ["ส่ายหน้า", "ไม่เอาาา"],
  ["เอียงคอค้างไว้", "หืมมม?"],
  ["ทำหน้าตกใจ / โกรธ / เศร้า", "ป้ายตามอารมณ์"],
];
const KEYS: [string, string][] = [["1–8", "เปลี่ยนตัวละคร"], ["E", "เอฟเฟกต์"], ["T", "ป้ายข้อความ"], ["M", "กระจก"], ["H", "โหมดประชุม"], ["G", "เปิด/ปิดคู่มือนี้"]];

// ───────────── animation of one card ─────────────

const IN = 0.6, HOLD = 1.0;
const smooth = (x: number) => x * x * (3 - 2 * x);

/** loop envelope: 0 → 1 → hold → 0 */
function envelope(tl: number, period: number) {
  const out = period - 0.7;
  if (tl < IN) return 0;
  if (tl < HOLD) return smooth((tl - IN) / (HOLD - IN));
  if (tl < out) return 1;
  if (tl < out + 0.4) return 1 - smooth((tl - out) / 0.4);
  return 0;
}

interface Card { canvas: HTMLCanvasElement; move: Move; filter: Filter; period: number; size: number }

function drawCard(c: Card, t: number, still: boolean, clock = t) {
  const m = c.move;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const ctx = c.canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c.size, c.size);
  const tl = still ? HOLD + 0.8 : t % c.period;
  const k = envelope(tl, c.period);

  const s = c.size * 0.25 * (1 + (m.lean ?? 0) * k);
  const pose = synthPose(c.size / 2, c.size * 0.64, s, (m.roll ?? 0) * k);
  const bs: Blendshapes = {};
  for (const [key, v] of Object.entries(m.bs ?? {})) bs[key] = v * k;
  // hands rise from below the chin up to their spot
  const hands = k > 0.05 && m.hands
    ? m.hands.map(([x, y]) => ({ x: pose.center.x + x * s, y: pose.center.y + (1.3 + (y - 1.3) * k) * s }))
    : [];
  const age = tl - HOLD;
  const gesture = m.gesture && age >= 0 && age < 2.2 ? { id: m.gesture, age } : null;
  const paw = gesture && (m.gesture === "nod" || m.gesture === "goforit") ? Math.min(1, age / 0.25, (2.2 - age) / 0.35) : 0;
  c.filter.draw(ctx, pose, bs, still ? clock : t, {
    mood: k > 0.5 ? m.mood ?? "neutral" : "neutral",
    moodLevel: k, paw, mirror: false, hands, gesture,
  });
}

// ───────────── DOM ─────────────

const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function steps(list: string[]) {
  const ol = document.createElement("ol");
  ol.className = "steps";
  for (const s of list) {
    const li = document.createElement("li");
    // [text] → chip
    for (const part of s.split(/(\[[^\]]+\])/)) {
      if (!part) continue;
      if (part.startsWith("[")) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = part.slice(1, -1);
        li.append(chip);
      } else li.append(part);
    }
    ol.append(li);
  }
  return ol;
}

export interface Guide {
  open(charId?: string): void;
  close(): void;
  toggle(charId?: string): void;
  isOpen(): boolean;
}

export function initGuide(opts: { onUse(id: string): void }): Guide {
  const root = document.getElementById("guide")!;
  root.innerHTML = `
    <div class="guide-backdrop"></div>
    <aside class="guide-sheet" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <header class="guide-head">
        <h2 id="guide-title">วิธีเล่นท่า</h2>
        <button class="guide-x" aria-label="ปิดคู่มือ">${ICON_CLOSE}</button>
      </header>
      <div class="guide-tabs" role="tablist" aria-label="ตัวละคร"></div>
      <div class="guide-body" role="tabpanel" tabindex="-1"></div>
    </aside>`;
  const sheet = root.querySelector<HTMLElement>(".guide-sheet")!;
  const tabs = root.querySelector<HTMLElement>(".guide-tabs")!;
  const body = root.querySelector<HTMLElement>(".guide-body")!;
  const closeBtn = root.querySelector<HTMLButtonElement>(".guide-x")!;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let current: CharGuide = GUIDES[0];
  let cards: Card[] = [];
  let raf = 0;
  let opener: Element | null = null;

  for (const g of GUIDES) {
    const b = document.createElement("button");
    b.role = "tab";
    b.className = "guide-tab";
    b.dataset.id = g.id;
    b.textContent = g.name;
    applyAccent(b, g.accent);
    b.onclick = () => show(g.id);
    tabs.append(b);
  }

  function card(move: Move, g: CharGuide, size: number, big: boolean): HTMLElement {
    const el = document.createElement("article");
    el.className = big ? "move move-big" : "move";
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size * dpr;
    canvas.style.width = canvas.style.height = `${size}px`;
    canvas.setAttribute("aria-hidden", "true");
    const text = document.createElement("div");
    const h = document.createElement("h4");
    h.textContent = move.title;
    text.append(h, steps(move.steps));
    if (move.result) {
      const p = document.createElement("p");
      p.className = "result";
      p.textContent = move.result;
      text.append(p);
    }
    el.append(canvas, text);
    cards.push({ canvas, move, filter: g.make(), period: move.gesture ? 3.9 : 3.2, size });
    return el;
  }

  function show(id: string) {
    current = GUIDES.find((g) => g.id === id) ?? GUIDES[0];
    applyAccent(sheet, current.accent);
    tabs.querySelectorAll<HTMLButtonElement>(".guide-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === current.id)));
    cards = [];
    body.replaceChildren();

    const intro = document.createElement("div");
    intro.className = "guide-intro";
    intro.innerHTML = `<div><p class="kind"></p><p class="tagline"></p></div>`;
    intro.querySelector(".kind")!.textContent = `${current.name} · ${current.kind}`;
    intro.querySelector(".tagline")!.textContent = current.tagline;
    const use = document.createElement("button");
    use.className = "guide-use";
    use.innerHTML = `${ICON_CHECK}<span>ใช้ตัวนี้</span>`;
    use.onclick = () => opts.onUse(current.id);
    intro.append(use);

    const section = (title: string, moves: Move[], big: boolean) => {
      const h = document.createElement("h3");
      h.textContent = title;
      const grid = document.createElement("div");
      grid.className = big ? "moves moves-big" : "moves";
      for (const m of moves) grid.append(card(m, current, big ? 132 : 96, big));
      body.append(h, grid);
    };
    body.append(intro);
    section("ท่าพิเศษ", current.specials, true);
    section("หน้าตา", current.faces, false);

    const h = document.createElement("h3");
    h.textContent = "ทุกตัวทำได้";
    const basics = document.createElement("dl");
    basics.className = "basics";
    for (const [doThis, get] of BASICS) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = doThis;
      dd.textContent = get;
      row.append(dt, dd);
      basics.append(row);
    }
    const keys = document.createElement("div");
    keys.className = "keys";
    for (const [k, v] of KEYS) {
      const span = document.createElement("span");
      const kbd = document.createElement("kbd");
      kbd.textContent = k;
      span.append(kbd, ` ${v}`);
      keys.append(span);
    }
    body.append(h, basics, keys);
    body.scrollTop = 0;
    if (still) drawAll(0);
  }

  function drawAll(t: number) {
    if (still) {
      // no loop: let the smoothed bits (arms, hands, ears) settle, then show the held pose
      for (const c of cards) for (let i = 0; i <= 45; i++) drawCard(c, 5 + i / 30, true, 5 + i / 30);
      return;
    }
    for (const c of cards) drawCard(c, t, false);
  }
  function loop() {
    drawAll(performance.now() / 1000);
    raf = requestAnimationFrame(loop);
  }

  const api: Guide = {
    isOpen: () => !root.hidden,
    open(charId) {
      opener = document.activeElement;
      root.hidden = false;
      show(GUIDES.some((g) => g.id === charId) ? charId! : current.id);
      requestAnimationFrame(() => root.classList.add("open"));
      closeBtn.focus();
      if (!still) { cancelAnimationFrame(raf); loop(); }
    },
    close() {
      root.classList.remove("open");
      cancelAnimationFrame(raf);
      root.hidden = true;
      cards = [];
      body.replaceChildren();
      (opener as HTMLElement | null)?.focus?.();
    },
    toggle(charId) { api.isOpen() ? api.close() : api.open(charId); },
  };
  closeBtn.onclick = api.close;
  root.querySelector<HTMLElement>(".guide-backdrop")!.onclick = api.close;
  root.hidden = true;
  return api;
}
