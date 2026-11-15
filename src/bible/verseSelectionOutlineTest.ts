/**
 * Sandbox UX — VerseSelection outline (underline + panneau bas).
 * Opt-in: `?verse-selection-outline=test` (DEV) ou `VITE_VERSE_SELECTION_OUTLINE=test`.
 * `off` / `0` / ausente → desligado. Não afecta Options de produção.
 */
const PARAM = "verse-selection-outline";
const DATA = "verseSelectionOutline";
const TEST_VALUE = "test";

export function bootVerseSelectionOutlineTest(): void {
  if (typeof document === "undefined") return;

  if (import.meta.env.DEV) {
    const fromUrl = new URLSearchParams(location.search).get(PARAM);
    if (fromUrl === "test") {
      document.documentElement.dataset[DATA] = TEST_VALUE;
      return;
    }
    delete document.documentElement.dataset[DATA];
    return;
  }

  const fromEnv = String(import.meta.env.VITE_VERSE_SELECTION_OUTLINE ?? "")
    .trim()
    .toLowerCase();
  if (fromEnv === "test") {
    document.documentElement.dataset[DATA] = TEST_VALUE;
    return;
  }
  delete document.documentElement.dataset[DATA];
}

export function isVerseSelectionOutlineTest(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset[DATA] === TEST_VALUE;
}
