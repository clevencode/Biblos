/**
 * Famílias de leitura do texto bíblico (OFL via Fontsource).
 * Pref: `bibleFont` em `BibleReadingPrefs`.
 * Carregamento: Literata eager; restantes sob pedido (menu / selecção).
 */
export type BibleFontId =
  | "literata"
  | "spectral"
  | "crimson"
  | "fraunces"
  | "playfair";

export type BibleFontOption = {
  id: BibleFontId;
  /** Nome CSS (Fontsource variable / static). */
  cssFamily: string;
  lineHeight: number;
  /** Chaves i18n: bible.font.<id>.label / .desc */
  labelKey: `bible.font.${BibleFontId}.label`;
  descKey: `bible.font.${BibleFontId}.desc`;
};

export const DEFAULT_BIBLE_FONT_ID: BibleFontId = "literata";

export const BIBLE_FONT_OPTIONS: readonly BibleFontOption[] = [
  {
    id: "literata",
    cssFamily: '"Literata Variable", Literata, Georgia, serif',
    lineHeight: 1.75,
    labelKey: "bible.font.literata.label",
    descKey: "bible.font.literata.desc",
  },
  {
    id: "spectral",
    cssFamily: "Spectral, Georgia, serif",
    lineHeight: 1.75,
    labelKey: "bible.font.spectral.label",
    descKey: "bible.font.spectral.desc",
  },
  {
    id: "crimson",
    cssFamily: '"Crimson Text", Georgia, serif',
    lineHeight: 1.7,
    labelKey: "bible.font.crimson.label",
    descKey: "bible.font.crimson.desc",
  },
  {
    id: "fraunces",
    cssFamily: '"Fraunces Variable", Fraunces, Georgia, serif',
    lineHeight: 1.75,
    labelKey: "bible.font.fraunces.label",
    descKey: "bible.font.fraunces.desc",
  },
  {
    id: "playfair",
    cssFamily: '"Playfair Display Variable", "Playfair Display", Georgia, serif',
    lineHeight: 1.7,
    labelKey: "bible.font.playfair.label",
    descKey: "bible.font.playfair.desc",
  },
] as const;

const BY_ID = Object.fromEntries(
  BIBLE_FONT_OPTIONS.map((opt) => [opt.id, opt]),
) as Record<BibleFontId, BibleFontOption>;

const loaded = new Set<BibleFontId>([DEFAULT_BIBLE_FONT_ID]);
let preloadStarted = false;

const LOADERS: Record<BibleFontId, () => Promise<unknown>> = {
  literata: () =>
    Promise.all([
      import("@fontsource-variable/literata"),
      import("@fontsource-variable/literata/wght-italic.css"),
    ]),
  spectral: () =>
    Promise.all([
      import("@fontsource/spectral/400.css"),
      import("@fontsource/spectral/400-italic.css"),
      import("@fontsource/spectral/600.css"),
    ]),
  crimson: () =>
    Promise.all([
      import("@fontsource/crimson-text/400.css"),
      import("@fontsource/crimson-text/400-italic.css"),
      import("@fontsource/crimson-text/600.css"),
    ]),
  fraunces: () => import("@fontsource-variable/fraunces"),
  playfair: () =>
    Promise.all([
      import("@fontsource-variable/playfair-display"),
      import("@fontsource-variable/playfair-display/wght-italic.css"),
    ]),
};

export function isBibleFontId(value: unknown): value is BibleFontId {
  return typeof value === "string" && value in BY_ID;
}

export function parseBibleFontId(
  value: unknown,
  fallback: BibleFontId = DEFAULT_BIBLE_FONT_ID,
): BibleFontId {
  return isBibleFontId(value) ? value : fallback;
}

export function bibleFontOption(id: BibleFontId): BibleFontOption {
  return BY_ID[id];
}

/** Garante faces no documento (idempotente). */
export function ensureBibleFontLoaded(id: BibleFontId): Promise<void> {
  if (loaded.has(id)) return Promise.resolve();
  return LOADERS[id]()
    .then(() => {
      loaded.add(id);
    })
    .catch(() => {
      /* rede / chunk — fallback Georgia no CSS */
    });
}

/** Pré-aquece as 5 famílias quando o menu Aa abre (idle). */
export function preloadBibleFonts(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  const run = () => {
    for (const opt of BIBLE_FONT_OPTIONS) {
      void ensureBibleFontLoaded(opt.id);
    }
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => run(), { timeout: 1200 });
    return;
  }
  setTimeout(run, 0);
}
