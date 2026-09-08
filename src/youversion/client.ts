import { bibleComUrl, toUsfm } from "./usfm";

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

async function yvFetch<T extends object>(
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
  return yvFetch<{
    bible?: YouVersionBible;
    books?: YouVersionBook[];
    usingFallback?: boolean;
  }>({ action: "books" });
}

export async function fetchPassage(reference: string, bibleId?: number) {
  const usfm = toUsfm(reference);
  return yvFetch<{
    bibleId?: number;
    passage?: YouVersionPassage;
  }>({
    action: "passage",
    usfm,
    bibleId: bibleId || undefined,
  });
}

export function openOnBibleCom(reference: string, bibleId: number) {
  const url = bibleComUrl(reference, bibleId);
  window.open(url, "_blank", "noopener,noreferrer");
}

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
