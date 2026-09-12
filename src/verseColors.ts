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
      if (!hex || isPresetVerseColor(hex) || seen.has(hex)) continue;
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
    .filter((hex, i, arr) => !isPresetVerseColor(hex) && arr.indexOf(hex) === i)
    .slice(0, MAX_FAVORITE_COLORS);
  try {
    localStorage.setItem(FAVORITE_COLORS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Ajoute une couleur custom en tête des favoris. */
export function addFavoriteVerseColor(hex: string): string[] {
  const n = normalizeVerseColor(hex);
  if (isPresetVerseColor(n)) return loadFavoriteVerseColors();
  const rest = loadFavoriteVerseColors().filter((c) => c !== n);
  return writeFavoriteVerseColors([n, ...rest]);
}

export function removeFavoriteVerseColor(hex: string): string[] {
  const n = normalizeVerseColor(hex);
  return writeFavoriteVerseColors(loadFavoriteVerseColors().filter((c) => c !== n));
}
