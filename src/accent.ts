/** Character accent colors as CSS variables (--accent / --accent-ink / --accent-line). */

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

export function applyAccent(el: HTMLElement, accent = "#1A1A1A") {
  const L = luminance(accent);
  el.style.setProperty("--accent", accent);
  el.style.setProperty("--accent-ink", L > 0.45 ? "#1A1A1A" : "#FFFFFF");
  // very light colors (Manow's lime) get a darker line so rings/switches still read on white
  el.style.setProperty("--accent-line", L > 0.55 ? `color-mix(in oklab, ${accent} 55%, black)` : accent);
}
