/**
 * Resolução O(1) de próximo/anterior capítulo e validação via manifesto.
 */

import type { BookManifest } from "../contracts/navigation.contract";
import {
  chapterStartUsfmId,
  decodeUsfmId,
  encodeUsfmId,
} from "./usfm.codec";

export type ManifestIndex = {
  byId: Map<number, BookManifest>;
  order: number[];
};

export function buildManifestIndex(
  books: readonly BookManifest[],
): ManifestIndex {
  const byId = new Map<number, BookManifest>();
  const order: number[] = [];
  for (const book of books) {
    byId.set(book.bookId, book);
    order.push(book.bookId);
  }
  return { byId, order };
}

export function isValidUsfmId(
  index: ManifestIndex,
  usfmId: number,
): boolean {
  const { bookId, chapter, verse } = decodeUsfmId(usfmId);
  const book = index.byId.get(bookId);
  if (!book) return false;
  if (chapter < 1 || chapter > book.versesPerChapter.length) return false;
  const maxV = book.versesPerChapter[chapter - 1] ?? 0;
  return verse >= 1 && verse <= maxV;
}

export function clampUsfmId(
  index: ManifestIndex,
  usfmId: number,
): number | null {
  const { bookId, chapter, verse } = decodeUsfmId(usfmId);
  const book = index.byId.get(bookId);
  if (!book || book.versesPerChapter.length === 0) return null;
  const c = Math.min(
    Math.max(1, chapter),
    book.versesPerChapter.length,
  );
  const maxV = book.versesPerChapter[c - 1] ?? 1;
  const v = Math.min(Math.max(1, verse || 1), maxV);
  return encodeUsfmId(bookId, c, v);
}

/** Capítulo linear seguinte/anterior no manifesto (ou sequência de plano). */
export function adjacentChapterStart(
  index: ManifestIndex,
  bookId: number,
  chapter: number,
  direction: "next" | "prev",
  planSequence?: number[],
): number | null {
  if (planSequence && planSequence.length > 0) {
    const current = chapterStartUsfmId(bookId, chapter);
    const pos = planSequence.findIndex((id) => {
      const d = decodeUsfmId(id);
      return d.bookId === bookId && d.chapter === chapter;
    });
    if (pos < 0) {
      // fallback: first / last relative
      const idx = planSequence.indexOf(current);
      if (idx < 0) return planSequence[0] ?? null;
      const next =
        direction === "next" ? planSequence[idx + 1] : planSequence[idx - 1];
      return next ?? null;
    }
    const next =
      direction === "next" ? planSequence[pos + 1] : planSequence[pos - 1];
    return next ?? null;
  }

  const book = index.byId.get(bookId);
  if (!book) return null;
  const delta = direction === "next" ? 1 : -1;
  const nextChapter = chapter + delta;
  if (nextChapter >= 1 && nextChapter <= book.versesPerChapter.length) {
    return chapterStartUsfmId(bookId, nextChapter);
  }

  const orderIdx = index.order.indexOf(bookId);
  if (orderIdx < 0) return null;
  const nextBookId = index.order[orderIdx + delta];
  if (nextBookId == null) return null;
  const nextBook = index.byId.get(nextBookId);
  if (!nextBook || nextBook.versesPerChapter.length === 0) return null;
  const ch =
    direction === "next" ? 1 : nextBook.versesPerChapter.length;
  return chapterStartUsfmId(nextBookId, ch);
}

export function labelForUsfmId(
  index: ManifestIndex,
  usfmId: number,
): string {
  const { bookId, chapter, verse } = decodeUsfmId(usfmId);
  const book = index.byId.get(bookId);
  const name = book?.name ?? book?.code ?? String(bookId);
  return `${name} ${chapter}.${verse}`;
}
