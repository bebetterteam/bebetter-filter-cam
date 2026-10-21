import { applyAccent } from "./accent";
import { FILTERS } from "./filters";
import type { Filter } from "./filters/types";
import { synthPose } from "./synthPose";

const KEY = "cutecam:v1";

export interface Settings {
  filter: string;
  effects: boolean;
  /** show the text stickers (รับทราบ, เย้!! …); the emote animations still play when off */
  captions: boolean;
  camera: string | null;
}

export function loadSettings(): Settings {
  const defaults: Settings = { filter: "bee", effects: true, captions: true, camera: null };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}

export interface UiHandlers {
  onFilter(id: string): void;
  onEffects(): void;
  onCaptions(): void;
  onMirror(): void;
  onClean(): void;
  onCamera(deviceId: string): void;
  onGuide(): void;
  /** Esc: closes the guide if it's open, otherwise toggles meeting mode */
  onEscape(): void;
}

// ───────────── character thumbnails: each filter draws itself on a tiny canvas ─────────────

const THUMB = 72; // CSS px
const SKIN = "#F2C9A8";
const SLASH_ICON =
  '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>';

function thumbnail(f: Filter): HTMLElement {
  if (f.id === "none") {
    const span = document.createElement("span");
    span.className = "thumb-icon";
    span.innerHTML = SLASH_ICON;
    return span;
  }
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const c = document.createElement("canvas");
  c.width = c.height = THUMB * dpr;
  c.setAttribute("aria-hidden", "true");
  const ctx = c.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const extras = { mood: "neutral" as const, moodLevel: 1, paw: 0, mirror: false, hands: [], gesture: null };
  if (f.mask) {
    // full characters: body ≈ 1.75 face-widths wide, ears/crest above
    f.draw(ctx, synthPose(THUMB / 2, THUMB * 0.6, 26), {}, 0, extras);
  } else {
    // ear filters sit on a simple face
    const pose = synthPose(THUMB / 2, THUMB * 0.62, 36);
    ctx.beginPath();
    ctx.ellipse(pose.center.x, pose.center.y, 18, 23, 0, 0, Math.PI * 2);
    ctx.fillStyle = SKIN;
    ctx.fill();
    f.draw(ctx, pose, {}, 0, extras);
  }
  return c;
}

export function buildUi(h: UiHandlers) {
  const tray = document.getElementById("filters")!;
  FILTERS.forEach((f, i) => {
    const b = document.createElement("button");
    b.className = "char";
    b.dataset.filter = f.id;
    b.setAttribute("aria-pressed", "false");
    b.title = `${f.label} (กด ${i + 1})`;
    const name = document.createElement("span");
    name.textContent = f.label;
    const kbd = document.createElement("kbd");
    kbd.textContent = String(i + 1);
    b.append(thumbnail(f), name, kbd);
    b.onclick = () => h.onFilter(f.id);
    tray.append(b);
  });
  document.getElementById("fx")!.onclick = h.onEffects;
  document.getElementById("captions")!.onclick = h.onCaptions;
  document.getElementById("mirror")!.onclick = h.onMirror;
  document.getElementById("hide")!.onclick = h.onClean;
  document.getElementById("guide-open")!.onclick = h.onGuide;
  const sel = document.getElementById("camera") as HTMLSelectElement;
  sel.onchange = () => h.onCamera(sel.value);

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= FILTERS.length) h.onFilter(FILTERS[n - 1].id);
    else if (e.key === "e" || e.key === "E") h.onEffects();
    else if (e.key === "t" || e.key === "T") h.onCaptions();
    else if (e.key === "m" || e.key === "M") h.onMirror();
    else if (e.key === "g" || e.key === "G") h.onGuide();
    else if (e.key === "Escape") h.onEscape();
    else if (e.key === "h" || e.key === "H") h.onClean();
  });
}

export function renderUi(s: Settings, mirror: boolean, cams: MediaDeviceInfo[], camId?: string) {
  document.querySelectorAll<HTMLButtonElement>(".char").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.filter === s.filter));
  });
  const sw = (id: string, on: boolean) => document.getElementById(id)!.setAttribute("aria-checked", String(on));
  sw("fx", s.effects);
  sw("captions", s.captions);
  sw("mirror", mirror);
  applyAccent(document.documentElement, FILTERS.find((f) => f.id === s.filter)?.accent);

  const sel = document.getElementById("camera") as HTMLSelectElement;
  sel.replaceChildren(
    ...(cams.length
      ? cams.map((c, i) => new Option(c.label || `กล้อง ${i + 1}`, c.deviceId, false, c.deviceId === camId))
      : [new Option("ยังไม่พบกล้อง", "", true, true)]),
  );
  sel.disabled = cams.length === 0;
}
