/**
 * Codec BBCCCVVV ↔ partes / código USFM string (GEN.1.1).
 * BB = bookId 1–99, CCC = capítulo, VVV = versículo.
 */

import { CANON_BOOKS } from "../../../youversion/canon";

const CODE_TO_ID = new Map<string, number>();
const ID_TO_CODE = new Map<number, string>();

(() => {
  CANON_BOOKS.forEach((book, index) => {
    const id = index + 1;
    CODE_TO_ID.set(book.id.toUpperCase(), id);
    ID_TO_CODE.set(id, book.id.toUpperCase());
  });
})();

/** Livros extras (ex.: 1 Enoque) — extensível. */
export function registerExtraBook(code: string, bookId: number): void {
  const c = code.toUpperCase();
  CODE_TO_ID.set(c, bookId);
  ID_TO_CODE.set(bookId, c);
}

export function bookCodeToId(code: string): number | null {
  return CODE_TO_ID.get(String(code || "").toUpperCase()) ?? null;
}

export function bookIdToCode(bookId: number): string | null {
  return ID_TO_CODE.get(bookId) ?? null;
}

export function encodeUsfmId(
  bookId: number,
  chapter: number,
  verse: number,
): number {
  const bb = Math.max(0, Math.min(99, Math.floor(bookId)));
  const ccc = Math.max(0, Math.min(999, Math.floor(chapter)));
  const vvv = Math.max(0, Math.min(999, Math.floor(verse)));
  return bb * 1_000_000 + ccc * 1_000 + vvv;
}

export function decodeUsfmId(usfmId: number): {
  bookId: number;
  chapter: number;
  verse: number;
} {
  const n = Math.floor(Math.abs(usfmId));
  const bookId = Math.floor(n / 1_000_000);
  const rem = n % 1_000_000;
  const chapter = Math.floor(rem / 1_000);
  const verse = rem % 1_000;
  return { bookId, chapter, verse };
}

/** "GEN.1.1" | "GEN.1" → usfmId (verso default 1). */
export function parseUsfmRef(ref: string): number | null {
  const raw = String(ref || "").trim().toUpperCase();
  const m = raw.match(/^([1-3]?[A-Z]+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const bookId = bookCodeToId(m[1]!);
  if (bookId == null) return null;
  const chapter = Number(m[2]);
  const verse = m[3] != null ? Number(m[3]) : 1;
  if (!Number.isFinite(chapter) || !Number.isFinite(verse)) return null;
  return encodeUsfmId(bookId, chapter, verse);
}

export function formatUsfmRef(usfmId: number, includeVerse = true): string {
  const { bookId, chapter, verse } = decodeUsfmId(usfmId);
  const code = bookIdToCode(bookId) ?? String(bookId).padStart(2, "0");
  if (!includeVerse) return `${code}.${chapter}`;
  return `${code}.${chapter}.${verse}`;
}

export function chapterStartUsfmId(bookId: number, chapter: number): number {
  return encodeUsfmId(bookId, chapter, 1);
}
