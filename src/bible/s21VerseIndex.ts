/**
 * Índice plano S21 em memória (singleton de sessão).
 * Warm-up único a partir do IndexedDB; buscas seguintes não releem o store.
 */

import { getAllOfflineBooks, getOfflineMeta, cleanVerseText } from "../bibleOffline";
import { buildIndexedVerse, type IndexedVerse } from "./s21SearchEngine";

let cache: IndexedVerse[] | null = null;
let warming: Promise<IndexedVerse[]> | null = null;

function buildFromRows(
  rows: Awaited<ReturnType<typeof getAllOfflineBooks>>,
  bookOrder: Map<string, number>,
): IndexedVerse[] {
  const verses: IndexedVerse[] = [];
  for (const row of rows) {
    const bookId = String(row.usfm || row.book.usfm || "").toUpperCase();
    if (!bookId) continue;
    const bookTitle = row.book.title || bookId;
    const canonIndex = bookOrder.get(bookId) ?? 999;
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

export function invalidateS21VerseIndex(): void {
  cache = null;
  warming = null;
}

export async function ensureS21VerseIndex(
  bookOrder?: Map<string, number>,
): Promise<IndexedVerse[]> {
  if (cache) return cache;
  if (warming) return warming;

  warming = (async () => {
    const meta = await getOfflineMeta();
    const books = meta?.books ?? [];
    const order =
      bookOrder ?? new Map(books.map((b, i) => [b.id.toUpperCase(), i]));
    const rows = await getAllOfflineBooks();
    const verses = buildFromRows(rows, order);
    cache = verses;
    warming = null;
    return verses;
  })();

  try {
    return await warming;
  } catch (err) {
    warming = null;
    throw err;
  }
}
