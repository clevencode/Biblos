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

export const DEFAULT_VERSE_COLOR = VERSE_COLORS[0]!.hex;

const PREFERRED_COLOR_KEY = "biblos.preferredVerseColor";
const PALETTE_STORE_KEY = "biblos.versePalettes";
export const MAX_VERSE_PALETTES = 5;

/** Harmonies de génération (thème clair → tons plutôt sombres). */
export type ColorHarmonyId =
  | "analogous"
  | "complementary"
  | "triad"
  | "split"
  | "mono";

export type ColorHarmony = {
  id: ColorHarmonyId;
  label: string;
};

export const COLOR_HARMONIES: readonly ColorHarmony[] = [
  { id: "analogous", label: "Analogues" },
  { id: "complementary", label: "Complémentaires" },
  { id: "triad", label: "Triade" },
  { id: "split", label: "Split" },
  { id: "mono", label: "Mono" },
] as const;

export type VersePalette = {
  id: string;
  harmony: ColorHarmonyId;
  colors: string[];
  createdAt: number;
};

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
  return VERSE_COLORS.some((c) => c.hex === n);
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hueNorm(h: number) {
  const x = h % 360;
  return x < 0 ? x + 360 : x;
}

/** HSL → hex (#rrggbb). s/l en 0–1. */
export function hslToHex(h: number, s: number, l: number): string {
  const hh = hueNorm(h) / 360;
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const r = Math.round(channel(hh + 1 / 3) * 255);
  const g = Math.round(channel(hh) * 255);
  const b = Math.round(channel(hh - 1 / 3) * 255);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function harmonyHues(base: number, harmony: ColorHarmonyId): number[] {
  const h = hueNorm(base);
  switch (harmony) {
    case "complementary":
      return [h, hueNorm(h + 180), hueNorm(h + 30), hueNorm(h + 150), hueNorm(h + 210)];
    case "triad":
      return [h, hueNorm(h + 120), hueNorm(h + 240), hueNorm(h + 60), hueNorm(h + 180)];
    case "split":
      return [h, hueNorm(h + 150), hueNorm(h + 210), hueNorm(h + 30), hueNorm(h + 330)];
    case "mono":
      return [h, h, h, h, h];
    case "analogous":
    default:
      return [h, hueNorm(h + 24), hueNorm(h - 24), hueNorm(h + 48), hueNorm(h - 48)];
  }
}

/**
 * Génère 5 couleurs sombres (luminosité basse) pour thème clair.
 * seedHue optionnel ; sinon aléatoire.
 */
export function generateDarkPalette(
  harmony: ColorHarmonyId,
  seedHue?: number,
): string[] {
  const base =
    seedHue != null && Number.isFinite(seedHue)
      ? hueNorm(seedHue)
      : Math.floor(Math.random() * 360);
  const hues = harmonyHues(base, harmony);
  const lights =
    harmony === "mono"
      ? [0.22, 0.28, 0.34, 0.3, 0.26]
      : [0.26, 0.3, 0.24, 0.34, 0.28];
  const sats =
    harmony === "mono"
      ? [0.42, 0.48, 0.55, 0.38, 0.5]
      : [0.52, 0.58, 0.48, 0.62, 0.55];
  return hues.map((hue, i) => hslToHex(hue, sats[i]!, lights[i]!));
}

export function loadVersePalettes(): VersePalette[] {
  try {
    const raw = localStorage.getItem(PALETTE_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as VersePalette;
        const colors = Array.isArray(row.colors)
          ? row.colors.map((c) => parseVerseHex(c)).filter((c): c is string => Boolean(c))
          : [];
        if (colors.length < 2) return null;
        return {
          id: String(row.id || `p-${row.createdAt || Date.now()}`),
          harmony: (COLOR_HARMONIES.some((h) => h.id === row.harmony)
            ? row.harmony
            : "analogous") as ColorHarmonyId,
          colors: colors.slice(0, 5),
          createdAt: Number(row.createdAt) || Date.now(),
        };
      })
      .filter((p): p is VersePalette => Boolean(p))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_VERSE_PALETTES);
  } catch {
    return [];
  }
}

export function saveVersePalettes(palettes: VersePalette[]): void {
  try {
    const next = palettes.slice(0, MAX_VERSE_PALETTES).map((p) => ({
      id: p.id,
      harmony: p.harmony,
      colors: p.colors.slice(0, 5).map((c) => normalizeVerseColor(c)),
      createdAt: p.createdAt,
    }));
    localStorage.setItem(PALETTE_STORE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Ajoute une palette en tête ; garde au plus MAX_VERSE_PALETTES. */
export function pushVersePalette(
  harmony: ColorHarmonyId,
  colors: string[],
): VersePalette[] {
  const palette: VersePalette = {
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    harmony,
    colors: colors.map((c) => normalizeVerseColor(c)).slice(0, 5),
    createdAt: Date.now(),
  };
  const next = [palette, ...loadVersePalettes()].slice(0, MAX_VERSE_PALETTES);
  saveVersePalettes(next);
  return next;
}

export function removeVersePalette(id: string): VersePalette[] {
  const next = loadVersePalettes().filter((p) => p.id !== id);
  saveVersePalettes(next);
  return next;
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
