/**
 * Bible S21 hors ligne — assets embutidos (/bible/s21/…).
 * APK: leitura direta dos assets (sem seed IndexedDB).
 * Web: assets + fallback /api/youversion; Cache Storage via Workbox.
 */

import { Capacitor } from "@capacitor/core";
import { apiUrl, readApiJson } from "./apiBase";
import { buildS21BookList, fetchBundledBookJson } from "./bibleS21Canon";
import { requestPersistentStorage } from "./offlineStorageGuard";
import type {
  BibleSearchHit,
  YouVersionBook,
  YouVersionPassage,
  YouVersionVerse,
} from "./youversion/client";
import { toUsfm } from "./youversion/usfm";

const META_KEY = "s21";
export const OFFLINE_BOOK_TOTAL = 66;

export type S21BookJson = {
  version?: string;
  book?: string;
  usfm?: string;
  title?: string;
  chapters: {
    chapter: number;
    verses: { number: number; text: string }[];
  }[];
};

export type OfflineBibleMeta = {
  key: typeof META_KEY;
  complete: boolean;
  count: number;
  total: number;
  at: number;
  books?: YouVersionBook[];
};

export type OfflineDownloadProgress = {
  done: number;
  total: number;
  usfm: string;
};

export type ChapterLayoutRow = {
  key: string;
  bookId: string;
  chapterId: string;
  verseCount: number;
  contentCharLength: number;
  indexedAt: number;
};

export function chapterLayoutKey(bookId: string, chapterId: string): string {
  return `${String(bookId || "").toUpperCase()}.${String(chapterId || "1")}`;
}

export function cleanVerseText(text: string): string {
  return String(text || "")
    .replace(/''/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export type OfflineBookRow = { usfm: string; book: S21BookJson };

/** Todos os livros a partir dos assets (índice de busca em RAM). */
export async function getAllOfflineBooks(): Promise<OfflineBookRow[]> {
  const list = buildS21BookList();
  const rows: OfflineBookRow[] = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const chunk = list.slice(i, i + CONCURRENCY);
    const loaded = await Promise.all(
      chunk.map(async (book) => {
        const usfm = book.id.toUpperCase();
        const json = await fetchBundledBookJson(usfm);
        return json ? ({ usfm, book: json } satisfies OfflineBookRow) : null;
      }),
    );
    for (const row of loaded) {
      if (row) rows.push(row);
    }
  }
  return rows;
}

function syntheticOfflineMeta(): OfflineBibleMeta {
  return {
    key: META_KEY,
    complete: true,
    count: OFFLINE_BOOK_TOTAL,
    total: OFFLINE_BOOK_TOTAL,
    at: Date.now(),
    books: buildS21BookList(),
  };
}

export async function getOfflineMeta(): Promise<OfflineBibleMeta | null> {
  if (!(await isOfflineBibleReady())) return null;
  return syntheticOfflineMeta();
}

let s21ReadyProbe: Promise<boolean> | null = null;

/** APK: sempre pronto (assets no pacote). Web: probe GEN no bundle (1×). */
export async function isOfflineBibleReady(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return true;
  if (!s21ReadyProbe) {
    s21ReadyProbe = (async () => {
      try {
        return Boolean(await fetchBundledBookJson("GEN"));
      } catch {
        return false;
      }
    })();
  }
  return s21ReadyProbe;
}

function chapterLayoutsFromBook(book: S21BookJson): ChapterLayoutRow[] {
  const bookId = String(book.book || book.usfm || "")
    .trim()
    .toUpperCase();
  if (!bookId) return [];
  const at = Date.now();
  return (book.chapters ?? []).map((ch) => {
    const chapterId = String(ch.chapter);
    const verses = (ch.verses ?? []).filter((v) => v.text);
    const contentCharLength = verses.reduce((acc, v) => acc + String(v.text).length, 0);
    return {
      key: chapterLayoutKey(bookId, chapterId),
      bookId,
      chapterId,
      verseCount: Math.max(verses.length, 1),
      contentCharLength: Math.max(contentCharLength, verses.length * 40),
      indexedAt: at,
    };
  });
}

/** Livro: assets embarcados → (web) API. Sem escrita IndexedDB. */
export async function resolveS21Book(usfm: string): Promise<S21BookJson | null> {
  const key = String(usfm || "")
    .trim()
    .toUpperCase()
    .split(".")[0];
  if (!key) return null;

  const bundled = await fetchBundledBookJson(key);
  if (bundled) return bundled;

  if (Capacitor.isNativePlatform()) return null;

  try {
    return validateS21BookPayload(key, await fetchBookPayload(key));
  } catch {
    return null;
  }
}

/** @deprecated Alias assets — sem IDB. */
export async function getOfflineBook(usfm: string): Promise<S21BookJson | null> {
  return resolveS21Book(usfm);
}

export async function clearOfflineBible(): Promise<void> {
  const { invalidateVerseIndex } = await import("./bible/verseIndexCache");
  invalidateVerseIndex("s21");
  void import("./bible/verseSearchClient").then(({ invalidateSearchIndexInWorker }) => {
    invalidateSearchIndexInWorker("s21");
  });
}

export async function getChapterLayout(
  bookId: string,
  chapterId: string,
): Promise<ChapterLayoutRow | null> {
  const bookJson = await resolveS21Book(bookId);
  if (!bookJson) return null;
  const chapter = String(chapterId || "1");
  const layouts = chapterLayoutsFromBook(bookJson);
  return layouts.find((row) => row.chapterId === chapter) ?? null;
}

/** Métricas do capítulo a partir do JSON do livro (assets). */
export async function resolveChapterVerseCount(
  bookId: string,
  chapterId: string,
): Promise<{ verseCount: number; contentCharLength: number } | null> {
  const bookJson = await resolveS21Book(bookId);
  if (!bookJson) return null;
  const chapter = Number(chapterId);
  const found = (bookJson.chapters ?? []).find((item) => Number(item.chapter) === chapter);
  if (!found) return null;
  const verses = (found.verses ?? []).filter((v) => v.text);
  if (!verses.length) return null;
  const contentCharLength = verses.reduce((acc, v) => acc + String(v.text).length, 0);
  return {
    verseCount: verses.length,
    contentCharLength: Math.max(contentCharLength, verses.length * 40),
  };
}

function parseUsfmRef(usfm: string) {
  const normalized = String(usfm || "")
    .trim()
    .toUpperCase()
    .replace(/:/g, ".");
  const [book = "JHN", chapterRaw = "1", versePart] = normalized.split(".");
  const chapter = Number(chapterRaw);
  let verseStart: number | null = null;
  let verseEnd: number | null = null;
  if (versePart) {
    const [a, b] = String(versePart).split("-");
    verseStart = Number(a);
    verseEnd = b ? Number(b) : verseStart;
  }
  return {
    book,
    chapter: Number.isFinite(chapter) && chapter > 0 ? chapter : 1,
    verseStart: Number.isFinite(verseStart!) ? verseStart : null,
    verseEnd: Number.isFinite(verseEnd!) ? verseEnd : null,
  };
}

function chapterVerses(
  bookJson: S21BookJson,
  chapter: number,
  verseStart: number | null,
  verseEnd: number | null,
): YouVersionVerse[] | null {
  const found = (bookJson.chapters ?? []).find((item) => Number(item.chapter) === chapter);
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

export async function offlinePassage(
  reference: string,
): Promise<{ ok: true; passage: YouVersionPassage } | { ok: false; error: string }> {
  const usfm = toUsfm(reference);
  const ref = parseUsfmRef(usfm);
  const bookJson = await resolveS21Book(ref.book);
  if (!bookJson) {
    return { ok: false, error: "Livre hors ligne introuvable" };
  }
  const verses = chapterVerses(bookJson, ref.chapter, ref.verseStart, ref.verseEnd);
  if (!verses?.length) {
    return { ok: false, error: "Passage introuvable (hors ligne)" };
  }
  const title = bookJson.title || ref.book;
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
}

export async function offlineSearch(
  q: string,
  limit = 40,
  bookOrder?: Map<string, number>,
  bookFilter?: Iterable<string> | null,
  scope?: import("./bible/verseSearchEngine").SearchScope,
): Promise<
  | {
      ok: true;
      q: string;
      total: number;
      results: BibleSearchHit[];
      bookCounts: Record<string, number>;
      facets?: import("./bible/verseSearchEngine").SearchFacets;
      matchMode?: import("./bible/verseSearchEngine").MatchMode;
      matchedTerms?: string[];
    }
  | { ok: false; error: string }
> {
  if (!(await isOfflineBibleReady())) {
    return { ok: false, error: "Bible hors ligne incomplete" };
  }

  const meta = await getOfflineMeta();
  const books = meta?.books ?? [];
  const order =
    bookOrder ?? new Map(books.map((b, i) => [b.id.toUpperCase(), i]));

  const { runLocalVerseSearch } = await import("./bible/localVerseSearch");
  return runLocalVerseSearch({
    version: "s21",
    q,
    limit,
    bookFilter: scope ? null : bookFilter,
    bookOrder: order,
    scope,
  });
}

async function fetchBookPayload(usfm: string): Promise<S21BookJson> {
  const key = String(usfm || "")
    .trim()
    .toUpperCase()
    .split(".")[0];
  if (Capacitor.isNativePlatform()) {
    const bundled = await fetchBundledBookJson(key);
    if (bundled) return bundled;
    throw new Error(`Livre introuvable dans le bundle (${key})`);
  }
  const qs = new URLSearchParams({ action: "book", usfm: key });
  const res = await fetch(apiUrl(`/api/youversion?${qs.toString()}`));
  const parsed = await readApiJson<{
    ok?: boolean;
    error?: string;
    book?: S21BookJson;
  }>(res);
  const json = parsed.data;
  if (!parsed.ok || !json?.ok || !json.book?.chapters) {
    throw new Error(json?.error || `Échec téléchargement ${key}`);
  }
  return json.book;
}

export function validateS21BookPayload(usfm: string, book: S21BookJson | null | undefined): S21BookJson {
  if (!book || !Array.isArray(book.chapters) || book.chapters.length === 0) {
    throw new Error(`Données invalides: ${usfm}`);
  }
  const hasVerse = book.chapters.some(
    (ch) => Array.isArray(ch.verses) && ch.verses.some((v) => String(v?.text || "").trim()),
  );
  if (!hasVerse) throw new Error(`Données invalides: ${usfm}`);
  return book;
}

/**
 * Assets-first: sem seed IndexedDB. Confirma assets e devolve meta sintética.
 */
export async function seedOfflineBibleFromBundledAssets(
  bookList: YouVersionBook[],
  onProgress?: (done: number, total: number, usfm: string) => void,
): Promise<OfflineBibleMeta> {
  const list = bookList.filter((b) => b?.id);
  const total = list.length || OFFLINE_BOOK_TOTAL;
  onProgress?.(0, total, "GEN");
  const probe = await fetchBundledBookJson("GEN");
  if (!probe) throw new Error("Assets S21 manquants");
  onProgress?.(total, total, "REV");
  void requestPersistentStorage();
  return syntheticOfflineMeta();
}

/**
 * Assets-first: sem download para IDB — só confirma disponibilidade / aquece cache HTTP.
 */
export async function downloadOfflineBible(
  bookList: YouVersionBook[],
  onProgress?: (p: OfflineDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<OfflineBibleMeta> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const list = bookList.filter((b) => b?.id);
  const total = list.length || OFFLINE_BOOK_TOTAL;
  onProgress?.({ done: 0, total, usfm: "GEN" });
  const meta = await seedOfflineBibleFromBundledAssets(list.length ? list : buildS21BookList(), (done, t, usfm) => {
    onProgress?.({ done, total: t, usfm });
  });
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return meta;
}
