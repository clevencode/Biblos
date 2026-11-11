/**
 * Índice plano de versículos em memória, keyed por versão.
 * Warm-up único por versão; buscas seguintes não releem storage.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import { buildIndexedVerse, type IndexedVerse } from "./verseSearchEngine";

const cache = new Map<BibleTextVersionId, IndexedVerse[]>();
const warming = new Map<BibleTextVersionId, Promise<IndexedVerse[]>>();

async function loadS21Index(bookOrder?: Map<string, number>): Promise<IndexedVerse[]> {
  const { getAllOfflineBooks, getOfflineMeta, cleanVerseText } = await import(
    "../bibleOffline"
  );
  const meta = await getOfflineMeta();
  const books = meta?.books ?? [];
  const order =
    bookOrder ?? new Map(books.map((b, i) => [b.id.toUpperCase(), i]));
  const rows = await getAllOfflineBooks();
  const verses: IndexedVerse[] = [];
  for (const row of rows) {
    const bookId = String(row.usfm || row.book.usfm || "").toUpperCase();
    if (!bookId) continue;
    const bookTitle = row.book.title || bookId;
    const canonIndex = order.get(bookId) ?? 999;
    for (const chapter of row.book.chapters ?? []) {
      const chapterNum = Number(chapter.chapter);
      if (!Number.isFinite(chapterNum)) continue;
      for (const verse of chapter.verses ?? []) {
        const number = Number(verse.number);
        const text = cleanVerseText(verse.text);
        if (!Number.isFinite(number) || !text) continue;
        verses.push(
          buildIndexedVerse({
            usfm: `${bookId}.${chapterNum}.${number}`,
            bookId,
            bookTitle,
            chapter: chapterNum,
            verse: number,
            raw: text,
            canonIndex,
          }),
        );
      }
    }
  }
  return verses;
}

async function loadHt98Index(): Promise<IndexedVerse[]> {
  const { loadHt1998Root } = await import("./ht1998");
  const root = await loadHt1998Root();
  const verses: IndexedVerse[] = [];
  root.books.forEach((book, canonIndex) => {
    const bookId = String(book.usfm || "").toUpperCase();
    if (!bookId) return;
    const bookTitle = book.title || bookId;
    for (const chapter of book.chapters ?? []) {
      const chapterNum = Number(chapter.chapter);
      if (!Number.isFinite(chapterNum)) continue;
      for (const verse of chapter.verses ?? []) {
        const number = Number(verse.number);
        const text = String(verse.text || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!Number.isFinite(number) || !text) continue;
        verses.push(
          buildIndexedVerse({
            usfm: `${bookId}.${chapterNum}.${number}`,
            bookId,
            bookTitle,
            chapter: chapterNum,
            verse: number,
            raw: text,
            canonIndex,
          }),
        );
      }
    }
  });
  return verses;
}

async function loadIndex(
  version: BibleTextVersionId,
  bookOrder?: Map<string, number>,
): Promise<IndexedVerse[]> {
  if (version === "ht98") return loadHt98Index();
  return loadS21Index(bookOrder);
}

export function invalidateVerseIndex(version?: BibleTextVersionId): void {
  if (version) {
    cache.delete(version);
    warming.delete(version);
    return;
  }
  cache.clear();
  warming.clear();
}

/** @deprecated Preferir invalidateVerseIndex("s21") */
export function invalidateS21VerseIndex(): void {
  invalidateVerseIndex("s21");
}

export async function ensureVerseIndex(
  version: BibleTextVersionId,
  bookOrder?: Map<string, number>,
): Promise<IndexedVerse[]> {
  const hit = cache.get(version);
  if (hit) return hit;

  const pending = warming.get(version);
  if (pending) return pending;

  const job = (async () => {
    const verses = await loadIndex(version, bookOrder);
    cache.set(version, verses);
    warming.delete(version);
    return verses;
  })();

  warming.set(version, job);
  try {
    return await job;
  } catch (err) {
    warming.delete(version);
    throw err;
  }
}

/** @deprecated Preferir ensureVerseIndex("s21", …) */
export async function ensureS21VerseIndex(
  bookOrder?: Map<string, number>,
): Promise<IndexedVerse[]> {
  return ensureVerseIndex("s21", bookOrder);
}
