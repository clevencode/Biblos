/** Índice da S21 completa a partir de data/bible/s21/books (ensaios). */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CANON_BOOKS } from "../../src/youversion/canon.ts";
import {
  buildIndexedVerse,
  buildTokenIndex,
  type IndexedVerse,
  type VerseSearchIndex,
} from "../../src/bible/verseSearchEngine.ts";

const dir = path.resolve("data/bible/s21/books");

export function loadS21Index(): VerseSearchIndex {
  const order = new Map(CANON_BOOKS.map((b, i) => [b.id.toUpperCase(), i]));
  const verses: IndexedVerse[] = [];
  for (const file of readdirSync(dir)) {
    const book = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    const bookId = String(book.usfm || book.book || "").toUpperCase();
    for (const ch of book.chapters ?? []) {
      for (const v of ch.verses ?? []) {
        if (!v.text) continue;
        verses.push(
          buildIndexedVerse({
            usfm: `${bookId}.${ch.chapter}.${v.number}`,
            bookId,
            bookTitle: book.title || bookId,
            chapter: Number(ch.chapter),
            verse: Number(v.number),
            raw: String(v.text).replace(/<[^>]+>/g, ""),
            canonIndex: order.get(bookId) ?? 999,
          }),
        );
      }
    }
  }
  verses.sort((a, b) => a.canonIndex - b.canonIndex || a.chapter - b.chapter || a.verse - b.verse);
  return buildTokenIndex(verses);
}

