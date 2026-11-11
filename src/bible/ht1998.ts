import type {
  BibleSearchHit,
  YouVersionBook,
  YouVersionBible,
  YouVersionPassage,
  YouVersionVerse,
} from "../youversion/client";
import { toUsfm } from "../youversion/usfm";
import { parseUsfmRef } from "./parseUsfmRef";

export const HT1998_BIBLE_META: YouVersionBible = {
  id: 1,
  abbreviation: "HAT98",
  title: "1998 Haïtienne",
  languageCode: "ht",
};

export const HT1998_JSON_URL = "/bibles/ht1998.json";

type Ht1998Verse = { number: number; text: string };
type Ht1998Chapter = { chapter: number; verses: Ht1998Verse[] };
type Ht1998Book = {
  usfm: string;
  title: string;
  shortTitle?: string;
  chapters: Ht1998Chapter[];
};

export type Ht1998Root = {
  abbreviation?: string;
  title?: string;
  languageCode?: string;
  books: Ht1998Book[];
};

let cachedRoot: Ht1998Root | null = null;
let inflight: Promise<Ht1998Root> | null = null;
let cachedBooks: YouVersionBook[] | null = null;

export function invalidateHt1998CatalogCache() {
  cachedRoot = null;
  cachedBooks = null;
  void import("./verseIndexCache").then(({ invalidateVerseIndex }) => {
    invalidateVerseIndex("ht98");
  });
}

function cleanVerseText(text: string): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadHt1998Root(): Promise<Ht1998Root> {
  if (cachedRoot) return cachedRoot;
  if (!inflight) {
    inflight = (async () => {
      const { readHt1998OfflineRoot } = await import("./ht1998Offline");
      const offline = await readHt1998OfflineRoot();
      if (offline) {
        cachedRoot = offline;
        return offline;
      }
      const res = await fetch(HT1998_JSON_URL);
      if (!res.ok) throw new Error("Traduction haïtienne indisponible");
      const json = (await res.json()) as Ht1998Root;
      if (!json?.books?.length) throw new Error("Catalogue haïtien vide");
      cachedRoot = json;
      return json;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export async function ht1998Books(): Promise<YouVersionBook[]> {
  if (cachedBooks) return cachedBooks;
  const root = await loadHt1998Root();
  cachedBooks = root.books.map((book) => {
    const id = String(book.usfm || "").trim().toUpperCase();
    const title = String(book.title || id);
    const chapters = book.chapters ?? [];
    return {
      id,
      title,
      fullTitle: title,
      abbreviation: book.shortTitle ?? id,
      chapters: chapters.map((ch) => {
        const chap = String(ch.chapter);
        return { id: chap, passageId: `${id}.${chap}`, title: null };
      }),
    };
  });
  return cachedBooks;
}

function chapterVerses(
  book: Ht1998Book,
  chapter: number,
  verseStart: number | null,
  verseEnd: number | null,
): YouVersionVerse[] | null {
  const found = (book.chapters ?? []).find((item) => Number(item.chapter) === chapter);
  if (!found) return null;
  let verses = (found.verses ?? [])
    .map((verse) => ({
      number: Number(verse.number),
      text: cleanVerseText(verse.text),
    }))
    .filter((verse) => Number.isFinite(verse.number) && verse.text);
  if (verseStart != null) {
    const end = verseEnd ?? verseStart;
    verses = verses.filter((verse) => verse.number >= verseStart && verse.number <= end);
  }
  return verses;
}

export async function ht1998Passage(
  reference: string,
): Promise<{ ok: true; passage: YouVersionPassage } | { ok: false; error: string }> {
  try {
    const usfm = toUsfm(reference);
    const ref = parseUsfmRef(usfm);
    const root = await loadHt1998Root();
    const book = root.books.find((b) => String(b.usfm).toUpperCase() === ref.book);
    if (!book) {
      return { ok: false, error: "Livre introuvable dans la version haïtienne" };
    }
    const verses = chapterVerses(book, ref.chapter, ref.verseStart, ref.verseEnd);
    if (!verses?.length) {
      return { ok: false, error: "Passage introuvable" };
    }
    const title = book.title || ref.book;
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

export async function ht1998Search(
  q: string,
  limit = 40,
  bookFilter?: string[] | null,
  scope?: import("./verseSearchEngine").SearchScope,
): Promise<
  | {
      ok: true;
      q: string;
      total: number;
      results: BibleSearchHit[];
      bookCounts: Record<string, number>;
      facets?: import("./verseSearchEngine").SearchFacets;
      matchMode?: import("./verseSearchEngine").MatchMode;
      matchedTerms?: string[];
    }
  | { ok: false; error: string }
> {
  const query = String(q || "").trim();
  if (normalizeSearchText(query).length < 2) {
    return { ok: false, error: "Saisissez au moins 2 caractères" };
  }

  const { runLocalVerseSearch } = await import("./localVerseSearch");
  const found = await runLocalVerseSearch({
    version: "ht98",
    q: query,
    limit,
    bookFilter: scope ? null : bookFilter,
    scope,
  });
  if (!found.ok) return found;
  return {
    ok: true,
    q: found.q,
    total: found.total,
    results: found.results,
    bookCounts: found.bookCounts,
    facets: found.facets,
    matchMode: found.matchMode,
    matchedTerms: found.matchedTerms,
  };
}
