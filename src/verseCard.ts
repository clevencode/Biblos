/**
 * VERSECARD / VerseMark a partir da Bible (YouVersion) — local-first.
 * Sync Notion (admin clevencode seulement): `verseCardSync.ts` (outbox → POST /api/verse-card).
 */
import { todayKey } from "./calendar";
import { applyRemoteOverride, notifyFlashcardRevision } from "./cardOverrides";
import { ensureLembrete } from "./retention";
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

/** Id estável por referência (évite doublons JEAN 3.16). */
export function verseCardId(frenteOrUsfm: string): string {
  return `verse-${stableUsfmKey(frenteOrUsfm) || "card"}`;
}

/** Id estável VerseMark (surlignage sync Notion). */
export function verseMarkCardId(frenteOrUsfm: string): string {
  return `mark-${stableUsfmKey(frenteOrUsfm) || "card"}`;
}

/**
 * Crée (ou met à jour) un flashcard local depuis un verset.
 * Frente MAJUSCULES · verso texte · statut Nouveau · lembrete = jour de création.
 */
export function createVerseFlashcard(input: {
  frente: string;
  verso: string;
  /** USFM optionnel (ex. JHN.3.16) pour un id stable. */
  usfm?: string;
  /** Surligneur (hex). Défaut: bleu. */
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
  const criadoEm = todayKey();
  const lembrete = ensureLembrete({
    status: "espera",
    lembrete: null,
    criadoEm,
    categoria: null,
  });
  const color = normalizeVerseColor(input.color ?? DEFAULT_VERSE_COLOR);

  const card: Flashcard = {
    id,
    frente,
    verso,
    categoria: null,
    status: "espera",
    url: "",
    lembrete,
    cardCategory: "VERSECARD",
    color,
    criadoEm,
  };

  // Overlay local (sans dirty Notion) — lembrete / status pour Timeline & Cartes
  applyRemoteOverride(
    id,
    {
      categoria: null,
      status: "espera",
      lembrete,
      facilStreak: 0,
      revisadoEm: null,
    },
    false,
  );
  notifyFlashcardRevision();

  return { ok: true, card, created: true };
}

/**
 * Crée (ou met à jour) un VerseMark local — Category Notion = VerseMark.
 * Frente MAJUSCULES · verso métadonnées usfm/color · hors révision Anki.
 */
export function createVerseMarkFlashcard(input: {
  frente: string;
  /** USFM ex. JHN.3.16 */
  usfm: string;
  color: string;
}): CreateVerseCardResult {
  const frente = String(input.frente || "")
    .trim()
    .toUpperCase();
  const usfm = String(input.usfm || "")
    .trim()
    .toUpperCase();
  if (!frente || !usfm) {
    return { ok: false, error: "Référence du verset manquante" };
  }

  const color = normalizeVerseColor(input.color);
  const id = verseMarkCardId(usfm);
  const criadoEm = todayKey();
  const lembrete = ensureLembrete({
    status: "espera",
    lembrete: null,
    criadoEm,
    categoria: null,
  });
  const verso = `usfm:${usfm}\ncolor:${color}`;

  const card: Flashcard = {
    id,
    frente,
    verso,
    categoria: null,
    status: "espera",
    url: "",
    lembrete,
    cardCategory: "VerseMark",
    color,
    criadoEm,
  };

  applyRemoteOverride(
    id,
    {
      categoria: null,
      status: "espera",
      lembrete,
      facilStreak: 0,
      revisadoEm: null,
    },
    false,
  );
  notifyFlashcardRevision();

  return { ok: true, card, created: true };
}
