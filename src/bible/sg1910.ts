import type {
  BibleSearchHit,
  YouVersionBook,
  YouVersionBible,
  YouVersionPassage,
  YouVersionVerse,
} from "../youversion/client";
import { buildS21BookList } from "../bibleS21Canon";
import { toUsfm } from "../youversion/usfm";
import { parseUsfmRef } from "./parseUsfmRef";

export const SG1910_BIBLE_META: YouVersionBible = {
  id: 2,
  abbreviation: "STR1910",
  title: "Segond 1910 (Strong)",
  languageCode: "fr",
};

export type StrongSegment = { text: string; strong?: string };

type Sg1910Verse = {
  number: number;
  text: string;
  segments?: StrongSegment[];
};
type Sg1910Chapter = { chapter: number; verses: Sg1910Verse[] };
type Sg1910Book = { usfm: string; chapters: Sg1910Chapter[] };

const bookCache = new Map<string, Sg1910Book>();
let cachedBooks: YouVersionBook[] | null = null;

function bookUrl(usfm: string): string {
  return `/bible/study/sg1910/books/${encodeURIComponent(usfm)}.json`;
}

function cleanVerseText(text: string): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadSg1910Book(usfm: string): Promise<Sg1910Book | null> {
  const id = String(usfm || "").trim().toUpperCase();
  if (!id) return null;
  if (bookCache.has(id)) return bookCache.get(id)!;
  const res = await fetch(bookUrl(id));
  if (!res.ok) return null;
  const json = (await res.json()) as Sg1910Book;
  if (!json?.chapters?.length) return null;
  bookCache.set(id, json);
  return json;
}

export async function sg1910Books(): Promise<YouVersionBook[]> {
  if (cachedBooks) return cachedBooks;
  const seed = buildS21BookList();
  cachedBooks = seed.map((book) => ({
    ...book,
    chapters: book.chapters.map((ch) => ({
      id: ch.id,
      passageId: ch.passageId,
      title: ch.title,
    })),
  }));
  return cachedBooks;
}

function chapterVerses(
  book: Sg1910Book,
  chapter: number,
  verseStart: number | null,
  verseEnd: number | null,
): YouVersionVerse[] | null {
  const found = book.chapters.find((item) => Number(item.chapter) === chapter);
  if (!found) return null;
  let verses = (found.verses ?? [])
    .map((verse) => ({
      number: Number(verse.number),
      text: cleanVerseText(verse.text),
      strongSegments: verse.segments?.length ? verse.segments : undefined,
    }))
    .filter((verse) => Number.isFinite(verse.number) && verse.text);
  if (verseStart != null) {
    const end = verseEnd ?? verseStart;
    verses = verses.filter((verse) => verse.number >= verseStart && verse.number <= end);
  }
  return verses;
}

export async function sg1910Passage(
  reference: string,
): Promise<{ ok: true; passage: YouVersionPassage } | { ok: false; error: string }> {
  try {
    const usfm = toUsfm(reference);
    const ref = parseUsfmRef(usfm);
    const book = await loadSg1910Book(ref.book);
    if (!book) {
      return { ok: false, error: "Livre introuvable (Strong 1910)" };
    }
    const verses = chapterVerses(book, ref.chapter, ref.verseStart, ref.verseEnd);
    if (!verses?.length) {
      return { ok: false, error: "Passage introuvable" };
    }
    const seed = buildS21BookList().find((b) => b.id === ref.book);
    const title = seed?.title ?? ref.book;
    const label =
      ref.verseStart != null
        ? `${title} ${ref.chapter}.${ref.verseStart}${
            ref.verseEnd && ref.verseEnd !== ref.verseStart ? `-${ref.verseEnd}` : ""
          }`
        : `${title} ${ref.chapter}`;
    return {
      ok: true,
      passage: {
        id: `${ref.book}.${ref.chapter}`,
        content: verses.map((verse) => verse.text).join(" "),
        reference: label,
        verses,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur de chargement",
    };
  }
}

function normalizeSearchText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function makeSnippet(text: string, queryNorm: string, radius = 60): string {
  const raw = String(text || "");
  const norm = normalizeSearchText(raw);
  const idx = norm.indexOf(queryNorm);
  if (idx < 0) {
    return raw.length > radius * 2 ? `${raw.slice(0, radius * 2).trim()}…` : raw;
  }
  const ratio = raw.length / Math.max(1, norm.length);
  const center = Math.round(idx * ratio);
  const start = Math.max(0, center - radius);
  const end = Math.min(raw.length, center + queryNorm.length * ratio + radius);
  const slice = raw.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < raw.length ? "…" : ""}`;
}

export async function sg1910Search(
  q: string,
  limit = 40,
  bookFilter?: string[] | null,
): Promise<
  | {
      ok: true;
      q: string;
      total: number;
      results: BibleSearchHit[];
      bookCounts: Record<string, number>;
    }
  | { ok: false; error: string }
> {
  const query = String(q || "").trim();
  const queryNorm = normalizeSearchText(query);
  if (queryNorm.length < 2) {
    return { ok: false, error: "Saisissez au moins 2 caractères" };
  }

  const filter =
    bookFilter?.length
      ? new Set(bookFilter.map((id) => id.toUpperCase()))
      : null;

  const results: BibleSearchHit[] = [];
  const bookCounts: Record<string, number> = {};
  const catalog = await sg1910Books();

  outer: for (const meta of catalog) {
    const bookId = meta.id.toUpperCase();
    if (filter && !filter.has(bookId)) continue;
    const book = await loadSg1910Book(bookId);
    if (!book) continue;
    const title = meta.title;
    for (const ch of book.chapters ?? []) {
      for (const verse of ch.verses ?? []) {
        const text = cleanVerseText(verse.text);
        const norm = normalizeSearchText(text);
        if (!norm.includes(queryNorm)) continue;
        bookCounts[bookId] = (bookCounts[bookId] ?? 0) + 1;
        results.push({
          usfm: `${bookId}.${ch.chapter}.${verse.number}`,
          bookTitle: title,
          chapter: Number(ch.chapter),
          verse: Number(verse.number),
          text,
          snippet: makeSnippet(text, queryNorm),
        });
        if (results.length >= limit) break outer;
      }
    }
  }

  return {
    ok: true,
    q: query,
    total: results.length,
    results,
    bookCounts,
  };
}
