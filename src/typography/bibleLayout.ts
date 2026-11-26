/**
 * Preferências de composição do texto bíblico (menu Texte).
 * Prefs: `textAlign` + `displayMode` em `BibleReadingPrefs`.
 */

export type BibleTextAlign = "left" | "justify";
export type BibleDisplayMode = "verses" | "paragraphs";

export const DEFAULT_BIBLE_TEXT_ALIGN: BibleTextAlign = "left";
export const DEFAULT_BIBLE_DISPLAY_MODE: BibleDisplayMode = "verses";

export function parseBibleTextAlign(
  value: unknown,
  fallback: BibleTextAlign = DEFAULT_BIBLE_TEXT_ALIGN,
): BibleTextAlign {
  return value === "left" || value === "justify" ? value : fallback;
}

export function parseBibleDisplayMode(
  value: unknown,
  fallback: BibleDisplayMode = DEFAULT_BIBLE_DISPLAY_MODE,
): BibleDisplayMode {
  return value === "verses" || value === "paragraphs" ? value : fallback;
}
