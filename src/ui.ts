import { FILTERS } from "./filters";

const KEY = "cutecam:v1";

export interface Settings {
  filter: string;
  effects: boolean;
  camera: string | null;
}

export function loadSettings(): Settings {
  const defaults: Settings = { filter: "bee", effects: true, camera: null };
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
  onMirror(): void;
  onClean(): void;
  onCamera(deviceId: string): void;
}

export function buildUi(h: UiHandlers) {
  const bar = document.getElementById("filters")!;
  FILTERS.forEach((f, i) => {
    const b = document.createElement("button");
    b.textContent = f.icon;
    b.title = `${f.label} (${i + 1})`;
    b.dataset.filter = f.id;
    b.onclick = () => h.onFilter(f.id);
    bar.append(b);
  });
  document.getElementById("fx")!.onclick = h.onEffects;
  document.getElementById("mirror")!.onclick = h.onMirror;
  document.getElementById("hide")!.onclick = h.onClean;
  const sel = document.getElementById("camera") as HTMLSelectElement;
  sel.onchange = () => h.onCamera(sel.value);

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLSelectElement) return;
    const n = Number(e.key);
    if (n >= 1 && n <= FILTERS.length) h.onFilter(FILTERS[n - 1].id);
    else if (e.key === "e" || e.key === "E") h.onEffects();
    else if (e.key === "m" || e.key === "M") h.onMirror();
    else if (e.key === "h" || e.key === "H" || e.key === "Escape") h.onClean();
  });
}

export function renderUi(s: Settings, mirror: boolean, cams: MediaDeviceInfo[], camId?: string) {
  document.querySelectorAll<HTMLButtonElement>("#filters button").forEach((b) => {
    b.classList.toggle("on", b.dataset.filter === s.filter);
  });
  document.getElementById("fx")!.classList.toggle("on", s.effects);
  document.getElementById("mirror")!.classList.toggle("on", mirror);
  const sel = document.getElementById("camera") as HTMLSelectElement;
  sel.replaceChildren(
    ...cams.map((c, i) => new Option(c.label || `Camera ${i + 1}`, c.deviceId, false, c.deviceId === camId)),
  );
}
