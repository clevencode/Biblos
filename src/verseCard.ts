/**
 * Cartes verset locales (hors sync) — UI flashcards désactivée ; conserve l’API pour le reader.
 */
import type { Flashcard } from "./types";
import { DEFAULT_VERSE_COLOR, normalizeVerseColor } from "./verseColors";
import { toUsfm } from "./youversion/usfm";

export type CreateVerseCardResult =
  | { ok: true; card: Flashcard; created: boolean }
  | { ok: false; error: string };

function stableUsfmKey(frenteOrUsfm: string): string {
  const usfm = toUsfm(frenteOrUsfm)
    .replace(/[^A-Z0-9.-]/gi, "")
    .toUpperCase();
  return (usfm || frenteOrUsfm.trim().toUpperCase().replace(/\s+/g, "-")).slice(0, 48);
}

export function verseCardId(frenteOrUsfm: string): string {
  return `verse-${stableUsfmKey(frenteOrUsfm) || "card"}`;
}

export function verseMarkCardId(frenteOrUsfm: string): string {
  return `mark-${stableUsfmKey(frenteOrUsfm) || "card"}`;
}

export function createVerseFlashcard(input: {
  frente: string;
  verso: string;
  usfm?: string;
  color?: string | null;
}): CreateVerseCardResult {
  const frente = String(input.frente || "")
    .trim()
    .toUpperCase();
  const verso = String(input.verso || "").trim();
  if (!frente || !verso) {
    return { ok: false, error: "Référence ou texte du verset manquant" };
  }

  const id = verseCardId(input.usfm?.trim() || frente);
  const color = normalizeVerseColor(input.color ?? DEFAULT_VERSE_COLOR);

  const card: Flashcard = {
    id,
    frente,
    verso,
    categoria: null,
    status: "espera",
    url: "",
    cardCategory: "VERSECARD",
    color,
    criadoEm: new Date().toISOString().slice(0, 10),
  };

  return { ok: true, card, created: true };
}
