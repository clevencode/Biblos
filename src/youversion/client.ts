import { toUsfm } from "./usfm";

export type YouVersionVerse = {
  number: number;
  text: string;
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

async function bibleFetch<T extends object>(
  params: Record<string, string | number | undefined>,
): Promise<ApiResult<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  try {
    const res = await fetch(`/api/youversion?${qs.toString()}`);
    const json = (await res.json()) as ApiResult<T>;
    return json;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } as ApiResult<T>;
  }
}

export async function fetchBooks() {
  return bibleFetch<{
    bible?: YouVersionBible;
    books?: YouVersionBook[];
    usingFallback?: boolean;
    fallbackReason?: string | null;
  }>({ action: "books" });
}

export async function fetchPassage(reference: string, _bibleId?: number) {
  const usfm = toUsfm(reference);
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

export async function searchVerses(q: string, limit = 40) {
  return bibleFetch<{
    bible?: YouVersionBible;
    q?: string;
    total?: number;
    results?: BibleSearchHit[];
  }>({
    action: "search",
    q,
    limit,
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
