/**
 * VERSECARD a partir da Bible (YouVersion) — local-first.
 * Sync Notion: `verseCardSync.ts` (outbox → POST /api/verse-card).
 */
import { todayKey } from "./calendar";
import { applyRemoteOverride, notifyFlashcardRevision } from "./cardOverrides";
import { ensureLembrete } from "./retention";
import type { Flashcard } from "./types";
import { toUsfm } from "./youversion/usfm";

export type CreateVerseCardResult =
  | { ok: true; card: Flashcard; created: boolean }
  | { ok: false; error: string };

/** Id estável por referência (évite doublons JEAN 3.16). */
export function verseCardId(frenteOrUsfm: string): string {
  const usfm = toUsfm(frenteOrUsfm)
    .replace(/[^A-Z0-9.-]/gi, "")
    .toUpperCase();
  const key = (usfm || frenteOrUsfm.trim().toUpperCase().replace(/\s+/g, "-")).slice(0, 48);
  return `verse-${key || "card"}`;
}

/**
 * Crée (ou met à jour) un flashcard local depuis un verset.
 * Frente MAJUSCULES · verso texte · lembrete auto (+2 j).
 */
export function createVerseFlashcard(input: {
  frente: string;
  verso: string;
  /** USFM optionnel (ex. JHN.3.16) pour un id stable. */
  usfm?: string;
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
    status: "estudo",
    lembrete: null,
    criadoEm,
    categoria: null,
  });

  const card: Flashcard = {
    id,
    frente,
    verso,
    categoria: null,
    status: "estudo",
    url: "",
    lembrete,
    cardCategory: "VERSECARD",
    criadoEm,
  };

  // Overlay local (sans dirty Notion) — lembrete / status pour Inbox & Cartes
  applyRemoteOverride(
    id,
    {
      categoria: null,
      status: "estudo",
      lembrete,
      facilStreak: 0,
      revisadoEm: null,
    },
    false,
  );
  notifyFlashcardRevision();

  return { ok: true, card, created: true };
}
