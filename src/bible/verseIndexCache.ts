/**
 * Índice de busca em memória (verses + tokenMap), keyed por versão.
 * Assets-first: build a partir dos JSON embutidos; sem persistência IndexedDB.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import {
  buildIndexedVerse,
  buildTokenIndex,
  type IndexedVerse,
  type VerseSearchIndex,
} from "./verseSearchEngine";

const cache = new Map<BibleTextVersionId, VerseSearchIndex>();
const warming = new Map<BibleTextVersionId, Promise<VerseSearchIndex>>();

function pushBookVerses(
  verses: IndexedVerse[],
  book: {
    usfm?: string;
    book?: string;
    title?: string;
    chapters?: {
      chapter: number;
      verses?: { number: number; text: string }[];
    }[];
  },
  order: Map<string, number>,
  cleanText: (raw: string) => string,
): void {
  const bookId = String(book.usfm || book.book || "")
    .trim()
    .toUpperCase();
  if (!bookId) return;
  const bookTitle = book.title || bookId;
  const canonIndex = order.get(bookId) ?? 999;
  for (const chapter of book.chapters ?? []) {
    const chapterNum = Number(chapter.chapter);
    if (!Number.isFinite(chapterNum)) continue;
    for (const verse of chapter.verses ?? []) {
      const number = Number(verse.number);
      const text = cleanText(String(verse.text || ""));
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

async function loadS21VersesFromBundle(
  order: Map<string, number>,
  cleanText: (raw: string) => string,
): Promise<IndexedVerse[]> {
  const { buildS21BookList, fetchBundledBookJson } = await import(
    "../bibleS21Canon"
  );
  const books = buildS21BookList();
  const verses: IndexedVerse[] = [];
  // Paralelismo limitado — evita saturar a rede no cold start.
  const CONCURRENCY = 8;
  for (let i = 0; i < books.length; i += CONCURRENCY) {
    const chunk = books.slice(i, i + CONCURRENCY);
    const loaded = await Promise.all(
      chunk.map(async (book) => {
        const json = await fetchBundledBookJson(book.id);
        return json;
      }),
    );
    for (const json of loaded) {
      if (json) pushBookVerses(verses, json, order, cleanText);
    }
  }
  return verses;
}

async function loadS21Verses(
  bookOrder?: Map<string, number>,
): Promise<{ verses: IndexedVerse[]; revision: string }> {
  const { cleanVerseText, OFFLINE_BOOK_TOTAL } = await import("../bibleOffline");
  const { buildS21BookList } = await import("../bibleS21Canon");
  const canon = buildS21BookList();
  const order =
    bookOrder ??
    new Map(canon.map((b, i) => [String(b.id).toUpperCase(), i]));

  const verses = await loadS21VersesFromBundle(order, cleanVerseText);
  const revision = `s21:${verses.length}:bundle`;
  if (verses.length === 0) {
    throw new Error(
      `Index S21 vide (bundle < ${OFFLINE_BOOK_TOTAL} livres)`,
    );
  }
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
    return;
  }
  cache.clear();
  warming.clear();
}

/** @deprecated Preferir invalidateVerseIndex("s21") */
export function invalidateS21VerseIndex(): void {
  invalidateVerseIndex("s21");
}

/**
 * Garante VerseSearchIndex em RAM (build a partir dos assets).
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
    const { index } = await buildIndexFromSource(version, bookOrder);
    cache.set(version, index);
    warming.delete(version);
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
