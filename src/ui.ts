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
  /** solid background color instead of the camera picture (only the mascot shows); null = camera */
  bg: string | null;
  /** keep the mascot fixed in the middle of the frame; it still follows expressions */
  pin: boolean;
}

export const BG_DEFAULT = "#00B140";
export const BG_PRESETS: { color: string | null; label: string }[] = [
  { color: null, label: "กล้อง" },
  { color: BG_DEFAULT, label: "เขียว (คีย์ OBS)" },
  { color: "#FFFFFF", label: "ขาว" },
  { color: "#FFE4EC", label: "ชมพูพาสเทล" },
  { color: "#CFE8FF", label: "ฟ้าพาสเทล" },
  { color: "#1E1B18", label: "เข้ม" },
];

export function loadSettings(): Settings {
  const defaults: Settings = { filter: "bee", effects: true, captions: true, camera: null, bg: null, pin: false };
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
  onPin(): void;
  onClean(): void;
  onCamera(deviceId: string): void;
  onBg(color: string | null): void;
  /** B: camera ↔ last used color */
  onBgToggle(): void;
  onGuide(): void;
  /** Esc: closes the guide if it's open, otherwise toggles meeting mode */
  onEscape(): void;
}

// ───────────── character thumbnails: each filter draws itself on a tiny canvas ─────────────

const THUMB = 72; // CSS px
const SKIN = "#F2C9A8";
const CAMERA_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M3.5 8.5a2 2 0 0 1 2-2h2l1.8-2h5.4l1.8 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.8" r="3.4"/></svg>';
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
  const bg = document.getElementById("bg")!;
  for (const p of BG_PRESETS) {
    const b = document.createElement("button");
    b.className = "swatch";
    b.dataset.bg = p.color ?? "";
    b.title = p.label;
    b.setAttribute("aria-label", p.label);
    b.setAttribute("aria-pressed", "false");
    if (p.color) b.style.background = p.color;
    else b.innerHTML = CAMERA_ICON;
    b.onclick = () => h.onBg(p.color);
    bg.append(b);
  }
  const pick = document.createElement("input");
  pick.type = "color";
  pick.id = "bg-custom";
  pick.className = "swatch custom";
  pick.title = "เลือกสีเอง";
  pick.setAttribute("aria-label", "เลือกสีเอง");
  pick.value = BG_DEFAULT;
  pick.oninput = () => h.onBg(pick.value.toUpperCase());
  bg.append(pick);

  document.getElementById("fx")!.onclick = h.onEffects;
  document.getElementById("captions")!.onclick = h.onCaptions;
  document.getElementById("mirror")!.onclick = h.onMirror;
  document.getElementById("pin")!.onclick = h.onPin;
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
    else if (e.key === "p" || e.key === "P") h.onPin();
    else if (e.key === "g" || e.key === "G") h.onGuide();
    else if (e.key === "Escape") h.onEscape();
    else if (e.key === "h" || e.key === "H") h.onClean();
    else if (e.key === "b" || e.key === "B") h.onBgToggle();
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
  sw("pin", s.pin);
  const preset = BG_PRESETS.some((p) => p.color === s.bg);
  document.querySelectorAll<HTMLButtonElement>("#bg button.swatch").forEach((b) => {
    b.setAttribute("aria-pressed", String((b.dataset.bg || null) === s.bg));
  });
  const pick = document.getElementById("bg-custom") as HTMLInputElement;
  pick.toggleAttribute("data-active", !!s.bg && !preset);
  if (s.bg) pick.value = s.bg.toLowerCase();
  applyAccent(document.documentElement, FILTERS.find((f) => f.id === s.filter)?.accent);

  const sel = document.getElementById("camera") as HTMLSelectElement;
  sel.replaceChildren(
    ...(cams.length
      ? cams.map((c, i) => new Option(c.label || `กล้อง ${i + 1}`, c.deviceId, false, c.deviceId === camId))
      : [new Option("ยังไม่พบกล้อง", "", true, true)]),
  );
  sel.disabled = cams.length === 0;
}
