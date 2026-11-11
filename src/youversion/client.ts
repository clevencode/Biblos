import { apiUrl, readApiJson } from "../apiBase";
import { buildS21BookList, S21_BIBLE_META } from "../bibleS21Canon";
import { localS21BooksResponse, useLocalBundledBible } from "../bibleEngine";
import { toUsfm } from "./usfm";
import {
  getOfflineMeta,
  isOfflineBibleReady,
  offlinePassage,
  offlineSearch,
} from "../bibleOffline";

export type StrongVerseSegment = { text: string; strong?: string };

export type YouVersionVerse = {
  number: number;
  text: string;
  strongSegments?: StrongVerseSegment[] | null;
};

export type YouVersionPassage = {
  id: string;
  content: string;
  reference: string | null;
  verses?: YouVersionVerse[] | null;
};

export type YouVersionBook = {
  id: string;
  title: string;
  fullTitle: string | null;
  abbreviation: string | null;
  chapters: { id: string; passageId: string; title: string | null }[];
};

export type YouVersionBible = {
  id: number;
  abbreviation: string;
  title: string;
  languageCode: string | null;
};

type ApiResult<T> = T & {
  ok: boolean;
  hasKey?: boolean;
  error?: string;
};

function canReachYouVersionApi(): boolean {
  if (useLocalBundledBible()) return false;
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

async function bibleFetch<T extends object>(
  params: Record<string, string | number | undefined>,
): Promise<ApiResult<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  try {
    const res = await fetch(apiUrl(`/api/youversion?${qs.toString()}`));
    const parsed = await readApiJson<ApiResult<T>>(res);
    if (!parsed.ok || !parsed.data) {
      return {
        ok: false,
        error: res.ok
          ? "Réponse API invalide"
          : `Recherche indisponible (${res.status})`,
      } as ApiResult<T>;
    }
    return parsed.data;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } as ApiResult<T>;
  }
}

export async function fetchBooks() {
  if (useLocalBundledBible()) {
    return localS21BooksResponse();
  }

  const meta = await getOfflineMeta();
  if (meta?.books?.length) {
    return {
      ok: true,
      hasKey: true,
      bible: {
        id: 0,
        abbreviation: "S21",
        title: "Segond 21",
        languageCode: "fr",
      },
      books: meta.books,
      usingFallback: true,
      fallbackReason: "offline",
    };
  }

  if (!canReachYouVersionApi()) {
    return {
      ok: true,
      hasKey: true,
      bible: S21_BIBLE_META,
      books: buildS21BookList(),
      usingFallback: true,
      fallbackReason: "seed",
    };
  }

  const network = await bibleFetch<{
    bible?: YouVersionBible;
    books?: YouVersionBook[];
    usingFallback?: boolean;
    fallbackReason?: string | null;
  }>({ action: "books" });
  if (network.ok && network.books?.length) return network;

  if (network.books?.length) return network;

  return {
    ok: true,
    hasKey: network.hasKey,
    bible: S21_BIBLE_META,
    books: buildS21BookList(),
    usingFallback: true,
    fallbackReason: "seed",
    error: network.error,
  };
}

export async function fetchPassage(reference: string, _bibleId?: number) {
  const usfm = toUsfm(reference);
  const local = await offlinePassage(usfm);
  if (local.ok) {
    return {
      ok: true,
      hasKey: true,
      bibleId: 0,
      bible: {
        id: 0,
        abbreviation: "S21",
        title: "Segond 21",
        languageCode: "fr",
      },
      usingFallback: false,
      passage: local.passage,
    };
  }

  if (useLocalBundledBible()) {
    return {
      ok: false,
      hasKey: true,
      error: local.error ?? "Passage introuvable",
    };
  }

  if (!canReachYouVersionApi()) {
    return {
      ok: false,
      hasKey: true,
      error: local.error ?? "Hors ligne — texte non disponible sans cache local.",
    };
  }

  return bibleFetch<{
    bibleId?: number;
    bible?: YouVersionBible;
    usingFallback?: boolean;
    passage?: YouVersionPassage;
  }>({
    action: "passage",
    usfm,
  });
}

export type BibleSearchHit = {
  usfm: string;
  bookTitle: string;
  chapter: number;
  verse: number;
  text: string;
  snippet: string;
};

export type BibleSearchResponse = {
  ok?: boolean;
  hasKey?: boolean;
  error?: string;
  bible?: YouVersionBible;
  q?: string;
  total?: number;
  results?: BibleSearchHit[];
  bookCounts?: Record<string, number>;
  matchMode?: import("../bible/verseSearchEngine").MatchMode;
  matchedTerms?: string[];
};

export async function searchVerses(
  q: string,
  limit = 40,
  options?: { books?: string[] | null },
): Promise<BibleSearchResponse> {
  const books = options?.books?.length
    ? options.books.map((id) => String(id).toUpperCase()).filter(Boolean)
    : null;

  if (await isOfflineBibleReady()) {
    const local = await offlineSearch(q, limit, undefined, books);
    if (local.ok) {
      return {
        ok: true,
        hasKey: true,
        bible: {
          id: 0,
          abbreviation: "S21",
          title: "Segond 21",
          languageCode: "fr",
        },
        q: local.q,
        total: local.total,
        results: local.results,
        bookCounts: local.bookCounts,
        matchMode: local.matchMode,
        matchedTerms: local.matchedTerms,
      };
    }
    if (useLocalBundledBible()) {
      return {
        ok: false,
        hasKey: true,
        error: local.error ?? "Index biblique en cours…",
      };
    }
  }

  if (useLocalBundledBible()) {
    return {
      ok: false,
      hasKey: true,
      error: "Index biblique en cours…",
    };
  }

  if (!canReachYouVersionApi()) {
    return {
      ok: false,
      hasKey: true,
      error: "Hors ligne — recherche indisponible sans index local.",
    };
  }

  return bibleFetch<BibleSearchResponse>({
    action: "search",
    q,
    limit,
    ...(books ? { books: books.join(",") } : {}),
  });
}

/** Identifiant local S21. */
export const LSG_BIBLE_ID = 0;

/** Chapitre précédent / suivant avec passage de livre (fin Matthieu → Marc 1). */
export function adjacentChapter(
  books: YouVersionBook[],
  bookId: string,
  chapterId: string,
  delta: -1 | 1,
): { bookId: string; chapterId: string } | null {
  if (!books.length) return null;
  const bookIndex = books.findIndex((b) => b.id.toUpperCase() === bookId.toUpperCase());
  if (bookIndex < 0) return null;
  const book = books[bookIndex]!;
  const chapters =
    book.chapters?.length > 0
      ? book.chapters.map((c) => c.id)
      : Array.from({ length: 50 }, (_, i) => String(i + 1));
  const chapterIndex = chapters.findIndex((id) => id === chapterId || id === String(Number(chapterId)));
  const idx = chapterIndex >= 0 ? chapterIndex : Math.max(0, Number(chapterId) - 1);
  const nextIdx = idx + delta;
  if (nextIdx >= 0 && nextIdx < chapters.length) {
    return { bookId: book.id, chapterId: chapters[nextIdx]! };
  }
  const nextBook = books[bookIndex + delta];
  if (!nextBook) return null;
  const nextChapters =
    nextBook.chapters?.length > 0
      ? nextBook.chapters.map((c) => c.id)
      : ["1"];
  return {
    bookId: nextBook.id,
    chapterId: delta > 0 ? nextChapters[0]! : nextChapters[nextChapters.length - 1]!,
  };
}

export function chapterUsfm(bookId: string, chapterId: string): string {
  return `${bookId}.${chapterId}`;
}

export function parseUsfmParts(reference: string): {
  bookId: string;
  chapterId: string;
  verse?: number;
} {
  const usfm = toUsfm(reference);
  const [book = "JHN", chapter = "1", versePart] = usfm.split(".");
  const verse = versePart ? Number(String(versePart).split("-")[0]) : undefined;
  return {
    bookId: book,
    chapterId: chapter,
    verse: Number.isFinite(verse) ? verse : undefined,
  };
}
