/**
 * VERSECARD / VerseMark locaux dans le catalogue (sans push Notion).
 */
import type { Catalog, Flashcard, Seed } from "./types";
import { createVerseMarkFlashcard } from "./verseCard";
import { listAllVerseMarks } from "./verseMarks";
import { formatVerseCardFront, toUsfm } from "./youversion/usfm";
import { CANON_BOOKS } from "./youversion/canon";
import { chapterUsfm } from "./youversion/client";
import { persistCatalogCache } from "./catalogSync";

function bookTitle(bookId: string): string {
  const hit = CANON_BOOKS.find((b) => b.id.toUpperCase() === bookId.toUpperCase());
  return hit?.title ?? bookId;
}

/** Insère ou met à jour une carte utilisateur (VerseMark / VERSECARD) sans persister. */
export function upsertUserFlashcardInCatalog(catalog: Catalog, card: Flashcard): Catalog {
  const notas = [...(catalog.notas ?? [])];
  const bucketKey = String(card.cardCategory || "VERSECARD");
  const bucketId = `bucket-${bucketKey.toLowerCase()}`;
  let seed = notas.find((item) => item.nota.id === bucketId);
  if (!seed) {
    seed = {
      nota: {
        id: bucketId,
        titulo: bucketKey,
        url: "",
        criadoEm: card.criadoEm || new Date().toISOString(),
        cartoes: 0,
      },
      materia: { id: `cat-${bucketKey.toLowerCase()}`, nome: bucketKey },
      disciplina: { id: `disc-${bucketKey.toLowerCase()}`, nome: bucketKey },
      flashcards: [],
    };
    notas.push(seed);
  }
  const existing = seed.flashcards.find((item) => item.id === card.id);
  const flashcards = existing
    ? seed.flashcards.map((item) =>
        item.id === card.id ? { ...item, ...card, url: card.url || item.url || "" } : item,
      )
    : [card, ...seed.flashcards];
  const nextSeed: Seed = {
    ...seed,
    flashcards,
    nota: { ...seed.nota, cartoes: flashcards.length },
  };
  const nextNotas = notas.map((item) => (item.nota.id === nextSeed.nota.id ? nextSeed : item));
  return { ...catalog, notas: nextNotas };
}

function upsertCardInCatalog(catalog: Catalog, card: Flashcard): Catalog {
  const next = upsertUserFlashcardInCatalog(catalog, card);
  persistCatalogCache(next);
  return next;
}

/** Chaque surlignage local a une carte VerseMark dans le catalogue. */
export function ensureLocalMarksInCatalog(catalog: Catalog): Catalog {
  let next = catalog;
  const known = new Set<string>();
  for (const note of next.notas ?? []) {
    for (const card of note.flashcards ?? []) {
      if (card.id) known.add(card.id);
    }
  }
  for (const mark of listAllVerseMarks()) {
    const usfm = `${chapterUsfm(mark.bookId, mark.chapterId)}.${mark.verse}`;
    const id = `mark-${usfm}`;
    if (known.has(id)) continue;
    const frente = formatVerseCardFront(bookTitle(mark.bookId), mark.chapterId, mark.verse);
    const created = createVerseMarkFlashcard({
      frente,
      usfm,
      color: mark.color,
    });
    if (!created.ok) continue;
    next = upsertCardInCatalog(next, created.card);
    known.add(created.card.id);
  }
  return next;
}

export function usfmFromCard(card: Flashcard): string | null {
  const fromVerso = String(card.verso || "").match(/usfm:([A-Z0-9.-]+)/i);
  if (fromVerso?.[1]) return fromVerso[1].toUpperCase();
  const id = String(card.id || "");
  if (id.startsWith("verse-") || id.startsWith("mark-")) {
    return id.replace(/^(verse|mark)-/i, "").toUpperCase() || null;
  }
  try {
    const usfm = toUsfm(card.frente || "");
    return usfm || null;
  } catch {
    return null;
  }
}
