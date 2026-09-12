/** Surligneurs style YouVersion — défaut bleu + couleur libre. */
export type VerseColor = {
  id: string;
  hex: string;
  label: string;
};

export const VERSE_COLORS: readonly VerseColor[] = [
  { id: "blue", hex: "#2563eb", label: "Bleu" },
  { id: "yellow", hex: "#e8b923", label: "Jaune" },
  { id: "green", hex: "#22a06b", label: "Vert" },
  { id: "orange", hex: "#e56910", label: "Orange" },
  { id: "pink", hex: "#e65caa", label: "Rose" },
  { id: "purple", hex: "#8270db", label: "Violet" },
] as const;

/** Trois préréglages rapides dans le sélecteur Marquer. */
export const VERSE_COLOR_PRESETS: readonly VerseColor[] = VERSE_COLORS.slice(0, 3);

export const DEFAULT_VERSE_COLOR = VERSE_COLORS[0]!.hex;

const PREFERRED_COLOR_KEY = "biblos.preferredVerseColor";
const FAVORITE_COLORS_KEY = "biblos.favoriteVerseColors";
export const MAX_FAVORITE_COLORS = 8;

/** Accepte #rgb / #rrggbb / id préréglé. */
export function parseVerseHex(value: string | null | undefined): string | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "");
  if (!raw) return null;
  const byId = VERSE_COLORS.find((c) => c.id === raw);
  if (byId) return byId.hex;
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

export function normalizeVerseColor(value: string | null | undefined): string {
  return parseVerseHex(value) ?? DEFAULT_VERSE_COLOR;
}

export function isPresetVerseColor(hex: string): boolean {
  const n = normalizeVerseColor(hex);
  return VERSE_COLOR_PRESETS.some((c) => c.hex === n);
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const normalized = parseVerseHex(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

/** Luminance relative WCAG (0–1). */
export function verseColorLuminance(hex: string): number {
  const rgb = parseHex(normalizeVerseColor(hex));
  if (!rgb) return 0.2;
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/** Hex normalisé en #rrggbb minuscule (affichage UI). */
export function formatVerseColorHex(hex: string): string {
  return normalizeVerseColor(hex);
}

/** Encre du ✓ sur swatch (contraste vs fond). */
export function verseSwatchCheckInk(hex: string): string {
  return verseColorLuminance(hex) >= 0.55 ? "#0d1117" : "#ffffff";
}

/** Nom approximatif FR pour a11y (ne repose pas sur la seule couleur). */
export function verseColorHueLabel(hex: string): string {
  const rgb = parseHex(normalizeVerseColor(hex));
  if (!rgb) return "Couleur";
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const light = (max + min) / (2 * 255);
  const sat = delta === 0 ? 0 : delta / (255 - Math.abs(2 * light * 255 - 255));

  if (sat < 0.12) {
    if (light > 0.85) return "Blanc";
    if (light > 0.55) return "Gris clair";
    if (light > 0.25) return "Gris";
    return "Noir";
  }

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  if (hue < 15 || hue >= 345) return light > 0.55 ? "Rose" : "Rouge";
  if (hue < 40) return "Orange";
  if (hue < 65) return "Jaune";
  if (hue < 150) return "Vert";
  if (hue < 200) return "Cyan";
  if (hue < 255) return "Bleu";
  if (hue < 290) return "Violet";
  return "Rose";
}

export type HsvColor = { h: number; s: number; v: number };

/** Valeur HSV par défaut selon le thème (tons foncés en light, clairs en dark). */
export function themeDefaultValue(theme: "light" | "dark"): number {
  return theme === "dark" ? 0.82 : 0.48;
}

export function hexToHsv(hex: string): HsvColor {
  const rgb = parseHex(normalizeVerseColor(hex));
  if (!rgb) return { h: 210, s: 0.65, v: 0.55 };
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(1, Math.max(0, s));
  const vv = Math.min(1, Math.max(0, v));
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const ch = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(rp)}${ch(gp)}${ch(bp)}`;
}

function mixHex(hex: string, toward: string, amount: number): string {
  const a = parseHex(hex);
  const b = parseHex(toward);
  if (!a || !b) return hex;
  const t = Math.min(1, Math.max(0, amount));
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[ch(a.r, b.r), ch(a.g, b.g), ch(a.b, b.b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

export type VerseActionTone = {
  /** Couleur de surlignage / carte. */
  tint: string;
  /** Fond du CTA « Créer flashcard ». */
  fill: string;
  /** Texte du CTA (contraste auto). */
  ink: string;
};

/**
 * Algo UX couleur : le swatch reste fidèle ;
 * le CTA s’adapte (assombri si trop clair) pour garder un contraste lisible.
 */
export function verseActionTone(hex: string): VerseActionTone {
  const tint = normalizeVerseColor(hex);
  const lum = verseColorLuminance(tint);
  if (lum >= 0.62) {
    return {
      tint,
      fill: mixHex(tint, "#0d1117", 0.22),
      ink: "#ffffff",
    };
  }
  if (lum >= 0.45) {
    return {
      tint,
      fill: mixHex(tint, "#0d1117", 0.1),
      ink: "#ffffff",
    };
  }
  return {
    tint,
    fill: tint,
    ink: "#ffffff",
  };
}

export function loadPreferredVerseColor(): string {
  try {
    return normalizeVerseColor(localStorage.getItem(PREFERRED_COLOR_KEY));
  } catch {
    return DEFAULT_VERSE_COLOR;
  }
}

export function savePreferredVerseColor(hex: string): void {
  try {
    localStorage.setItem(PREFERRED_COLOR_KEY, normalizeVerseColor(hex));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadFavoriteVerseColors(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITE_COLORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      const hex = parseVerseHex(String(item ?? ""));
      if (!hex || seen.has(hex)) continue;
      seen.add(hex);
      out.push(hex);
      if (out.length >= MAX_FAVORITE_COLORS) break;
    }
    return out;
  } catch {
    return [];
  }
}

function writeFavoriteVerseColors(colors: string[]): string[] {
  const next = colors
    .map((c) => normalizeVerseColor(c))
    .filter((hex, i, arr) => arr.indexOf(hex) === i)
    .slice(0, MAX_FAVORITE_COLORS);
  try {
    localStorage.setItem(FAVORITE_COLORS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Ajoute une couleur utilisateur en tête des favoris. */
export function addFavoriteVerseColor(hex: string): string[] {
  const n = normalizeVerseColor(hex);
  const rest = loadFavoriteVerseColors().filter((c) => c !== n);
  return writeFavoriteVerseColors([n, ...rest]);
}

export function removeFavoriteVerseColor(hex: string): string[] {
  const n = normalizeVerseColor(hex);
  return writeFavoriteVerseColors(loadFavoriteVerseColors().filter((c) => c !== n));
}
