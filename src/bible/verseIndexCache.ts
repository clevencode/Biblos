/**
 * Índice de busca em memória (verses + tokenMap), keyed por versão.
 * Persistência: idbSearchCache. Warm-up: ensureVerseIndex / warmSearchIndex.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import { clearSearchIndex, readSearchIndex, writeSearchIndex } from "./idbSearchCache";
import {
  buildIndexedVerse,
  buildTokenIndex,
  type IndexedVerse,
  type VerseSearchIndex,
} from "./verseSearchEngine";

const cache = new Map<BibleTextVersionId, VerseSearchIndex>();
const warming = new Map<BibleTextVersionId, Promise<VerseSearchIndex>>();

async function loadS21Verses(
  bookOrder?: Map<string, number>,
): Promise<{ verses: IndexedVerse[]; revision: string }> {
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
  const revision = `s21:${verses.length}:${meta?.count ?? 0}:${meta?.at ?? 0}`;
  return { verses, revision };
}

async function loadHt98Verses(): Promise<{
  verses: IndexedVerse[];
  revision: string;
}> {
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
  const revision = `ht98:${verses.length}:${root.books.length}`;
  return { verses, revision };
}

async function buildIndexFromSource(
  version: BibleTextVersionId,
  bookOrder?: Map<string, number>,
): Promise<{ index: VerseSearchIndex; revision: string }> {
  const loaded =
    version === "ht98"
      ? await loadHt98Verses()
      : await loadS21Verses(bookOrder);
  return { index: buildTokenIndex(loaded.verses), revision: loaded.revision };
}

export function invalidateVerseIndex(version?: BibleTextVersionId): void {
  if (version) {
    cache.delete(version);
    warming.delete(version);
    void clearSearchIndex(version);
    return;
  }
  cache.clear();
  warming.clear();
  void clearSearchIndex();
}

/** @deprecated Preferir invalidateVerseIndex("s21") */
export function invalidateS21VerseIndex(): void {
  invalidateVerseIndex("s21");
}

/**
 * Garante VerseSearchIndex em RAM (IDB → build → write IDB).
 */
export async function ensureVerseIndex(
  version: BibleTextVersionId,
  bookOrder?: Map<string, number>,
): Promise<VerseSearchIndex> {
  const hit = cache.get(version);
  if (hit) return hit;

  const pending = warming.get(version);
  if (pending) return pending;

  const job = (async () => {
    const stored = await readSearchIndex(version);
    if (stored?.verses?.length) {
      const index: VerseSearchIndex = {
        verses: stored.verses,
        tokenMap: stored.tokenMap,
        uniqueTokens: stored.uniqueTokens,
      };
      cache.set(version, index);
      warming.delete(version);
      return index;
    }

    const { index, revision } = await buildIndexFromSource(version, bookOrder);
    cache.set(version, index);
    warming.delete(version);
    void writeSearchIndex(version, index, revision).catch(() => undefined);
    return index;
  })();

  warming.set(version, job);
  try {
    return await job;
  } catch (err) {
    warming.delete(version);
    throw err;
  }
}

/** Só o array de versículos (compat callers). */
export async function ensureVerseIndexVerses(
  version: BibleTextVersionId,
  bookOrder?: Map<string, number>,
): Promise<IndexedVerse[]> {
  const index = await ensureVerseIndex(version, bookOrder);
  return index.verses;
}

/** @deprecated Preferir ensureVerseIndex("s21", …) */
export async function ensureS21VerseIndex(
  bookOrder?: Map<string, number>,
): Promise<VerseSearchIndex> {
  return ensureVerseIndex("s21", bookOrder);
}

/**
 * Pré-aquece o índice da versão em idle (main ou via worker client).
 */
export function scheduleSearchIndexWarmup(
  versionId: BibleTextVersionId,
): void {
  const run = () => {
    void ensureVerseIndex(versionId).catch(() => undefined);
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => run(), { timeout: 4000 });
  } else {
    window.setTimeout(run, 1200);
  }
}
