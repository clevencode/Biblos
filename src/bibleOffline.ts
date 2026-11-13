/**
 * Bible S21 hors ligne — IndexedDB (~6 Mo, 66 livres).
 * Mobile : assets embarqués (/bible/s21/…) ; web : fallback /api/youversion.
 */

import { Capacitor } from "@capacitor/core";
import { apiUrl, readApiJson } from "./apiBase";
import { fetchBundledBookJson } from "./bibleS21Canon";
import {
  isQuotaExceededError,
  requestPersistentStorage,
} from "./offlineStorageGuard";
import type {
  BibleSearchHit,
  YouVersionBook,
  YouVersionPassage,
  YouVersionVerse,
} from "./youversion/client";
import { toUsfm } from "./youversion/usfm";

const DB_NAME = "biblos-s21-offline";
const DB_VERSION = 2;
const STORE_BOOKS = "books";
const STORE_META = "meta";
const STORE_CHAPTER_LAYOUT = "chapter_layout";
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

/** Todos os livros no IndexedDB (uma leitura; usado pelo índice de busca em RAM). */
export async function getAllOfflineBooks(): Promise<OfflineBookRow[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_BOOKS, "readonly");
    const rows = await idbReq(
      tx.objectStore(STORE_BOOKS).getAll() as IDBRequest<OfflineBookRow[]>,
    );
    await idbTxDone(tx);
    return rows ?? [];
  } finally {
    db.close();
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponible"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: "usfm" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_CHAPTER_LAYOUT)) {
        db.createObjectStore(STORE_CHAPTER_LAYOUT, { keyPath: "key" });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB error"));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx error"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx abort"));
  });
}

export async function getOfflineMeta(): Promise<OfflineBibleMeta | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_META, "readonly");
      const row = await idbReq(
        tx.objectStore(STORE_META).get(META_KEY) as IDBRequest<OfflineBibleMeta | undefined>,
      );
      await idbTxDone(tx);
      return row ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function isOfflineBibleReady(): Promise<boolean> {
  const meta = await getOfflineMeta();
  return Boolean(meta?.complete && (meta.count ?? 0) >= OFFLINE_BOOK_TOTAL);
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

async function putChapterLayouts(rows: ChapterLayoutRow[]): Promise<void> {
  if (!rows.length) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_CHAPTER_LAYOUT, "readwrite");
    const store = tx.objectStore(STORE_CHAPTER_LAYOUT);
    for (const row of rows) store.put(row);
    await idbTxDone(tx);
  } finally {
    db.close();
  }
}

async function putBook(usfm: string, book: S21BookJson): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([STORE_BOOKS, STORE_CHAPTER_LAYOUT], "readwrite");
    tx.objectStore(STORE_BOOKS).put({ usfm, book });
    const layouts = chapterLayoutsFromBook(book);
    const layoutStore = tx.objectStore(STORE_CHAPTER_LAYOUT);
    for (const row of layouts) layoutStore.put(row);
    await idbTxDone(tx);
  } finally {
    db.close();
  }
}

/** Livro: assets embarquados (mobile) → IndexedDB → null. Grava no IDB em background. */
export async function resolveS21Book(usfm: string): Promise<S21BookJson | null> {
  const key = String(usfm || "")
    .trim()
    .toUpperCase()
    .split(".")[0];
  if (!key) return null;

  if (Capacitor.isNativePlatform()) {
    const bundled = await fetchBundledBookJson(key);
    if (bundled) {
      void putBook(key, bundled).catch(() => undefined);
      return bundled;
    }
  }

  const cached = await getOfflineBook(key);
  if (cached) return cached;

  if (!Capacitor.isNativePlatform()) {
    const bundled = await fetchBundledBookJson(key);
    if (bundled) {
      void putBook(key, bundled).catch(() => undefined);
      return bundled;
    }
  }

  return null;
}

export async function getOfflineBook(usfm: string): Promise<S21BookJson | null> {
  const key = String(usfm || "")
    .trim()
    .toUpperCase()
    .split(".")[0];
  if (!key) return null;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_BOOKS, "readonly");
      const row = await idbReq(
        tx.objectStore(STORE_BOOKS).get(key) as IDBRequest<{ usfm: string; book: S21BookJson } | undefined>,
      );
      await idbTxDone(tx);
      return row?.book ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function clearOfflineBible(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([STORE_BOOKS, STORE_META, STORE_CHAPTER_LAYOUT], "readwrite");
    tx.objectStore(STORE_BOOKS).clear();
    tx.objectStore(STORE_META).clear();
    if (tx.objectStoreNames.contains(STORE_CHAPTER_LAYOUT)) {
      tx.objectStore(STORE_CHAPTER_LAYOUT).clear();
    }
    await idbTxDone(tx);
  } finally {
    db.close();
  }
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
  const key = chapterLayoutKey(bookId, chapterId);
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_CHAPTER_LAYOUT, "readonly");
      const row = await idbReq(
        tx.objectStore(STORE_CHAPTER_LAYOUT).get(key) as IDBRequest<ChapterLayoutRow | undefined>,
      );
      await idbTxDone(tx);
      return row ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Lecture hors-ligne du JSON livre — dérive les métriques si le store layout est vide. */
export async function resolveChapterVerseCount(
  bookId: string,
  chapterId: string,
): Promise<{ verseCount: number; contentCharLength: number } | null> {
  const cached = await getChapterLayout(bookId, chapterId);
  if (cached) {
    return {
      verseCount: cached.verseCount,
      contentCharLength: cached.contentCharLength,
    };
  }
  const bookJson = await resolveS21Book(bookId);
  if (!bookJson) return null;
  const chapter = Number(chapterId);
  const found = (bookJson.chapters ?? []).find((item) => Number(item.chapter) === chapter);
  if (!found) return null;
  const verses = (found.verses ?? []).filter((v) => v.text);
  if (!verses.length) return null;
  const contentCharLength = verses.reduce((acc, v) => acc + String(v.text).length, 0);
  void putChapterLayouts(chapterLayoutsFromBook(bookJson)).catch(() => undefined);
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
 * Commit atômico: substitui o store final só se a validação passou.
 * Uma versão `complete` anterior permanece intacta se a tx falhar.
 */
async function commitOfflineBibleAtomic(
  payloads: Map<string, S21BookJson>,
  bookList: YouVersionBook[],
): Promise<OfflineBibleMeta> {
  if (payloads.size < OFFLINE_BOOK_TOTAL && payloads.size < bookList.length) {
    throw new Error("Téléchargement incomplet");
  }
  for (const [usfm, book] of payloads) {
    validateS21BookPayload(usfm, book);
  }

  const meta: OfflineBibleMeta = {
    key: META_KEY,
    complete: true,
    count: payloads.size,
    total: Math.max(bookList.length, OFFLINE_BOOK_TOTAL),
    at: Date.now(),
    books: bookList,
  };

  const db = await openDb();
  try {
    const tx = db.transaction(
      [STORE_BOOKS, STORE_META, STORE_CHAPTER_LAYOUT],
      "readwrite",
    );
    const booksStore = tx.objectStore(STORE_BOOKS);
    const layoutStore = tx.objectStore(STORE_CHAPTER_LAYOUT);
    booksStore.clear();
    layoutStore.clear();
    for (const [usfm, book] of payloads) {
      booksStore.put({ usfm, book });
      for (const row of chapterLayoutsFromBook(book)) {
        layoutStore.put(row);
      }
    }
    tx.objectStore(STORE_META).put(meta);
    await idbTxDone(tx);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw new Error("Espace de stockage insuffisant pour la Bible hors ligne");
    }
    throw err;
  } finally {
    db.close();
  }
  return meta;
}

/**
 * Indexa os 66 livros a partir dos JSON embarcados (APK) — sem rede.
 * Fetch completo em memória → commit atômico.
 */
export async function seedOfflineBibleFromBundledAssets(
  bookList: YouVersionBook[],
  onProgress?: (done: number, total: number, usfm: string) => void,
): Promise<OfflineBibleMeta> {
  const list = bookList.filter((b) => b?.id);
  if (!list.length) throw new Error("Liste de livres vide");

  await requestPersistentStorage();

  const total = list.length;
  let done = 0;
  const concurrency = 2;
  let cursor = 0;
  const payloads = new Map<string, S21BookJson>();

  const yieldMain = () =>
    new Promise<void>((resolve) => {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => resolve(), { timeout: 48 });
      } else {
        setTimeout(resolve, 0);
      }
    });

  async function worker() {
    while (cursor < list.length) {
      const index = cursor++;
      const book = list[index]!;
      const usfm = book.id.toUpperCase();
      const json = await fetchBundledBookJson(usfm);
      if (!json) throw new Error(`Asset manquant: ${usfm}`);
      payloads.set(usfm, validateS21BookPayload(usfm, json));
      done += 1;
      onProgress?.(done, total, usfm);
      await yieldMain();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()));

  const meta = await commitOfflineBibleAtomic(payloads, bookList);
  const { invalidateVerseIndex } = await import("./bible/verseIndexCache");
  invalidateVerseIndex("s21");
  void import("./bible/verseSearchClient").then(({ invalidateSearchIndexInWorker }) => {
    invalidateSearchIndexInWorker("s21");
  });
  return meta;
}

/**
 * Télécharge les 66 livres S21 dans IndexedDB.
 * Fetch + validation em memória; commit atômico (sem parciais no store final).
 */
export async function downloadOfflineBible(
  bookList: YouVersionBook[],
  onProgress?: (p: OfflineDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<OfflineBibleMeta> {
  const list = bookList.filter((b) => b?.id);
  if (!list.length) throw new Error("Liste de livres vide");
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  await requestPersistentStorage();

  const total = list.length;
  let done = 0;
  const concurrency = 4;
  let cursor = 0;
  const payloads = new Map<string, S21BookJson>();

  async function worker() {
    while (cursor < list.length) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const index = cursor++;
      const book = list[index]!;
      const usfm = book.id.toUpperCase();
      const json = await fetchBookPayload(usfm);
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      payloads.set(usfm, validateS21BookPayload(usfm, json));
      done += 1;
      onProgress?.({ done, total, usfm });
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, list.length) }, () => worker()),
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw new Error("Espace de stockage insuffisant pour la Bible hors ligne");
    }
    throw err;
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (payloads.size !== total) {
    throw new Error("Téléchargement incomplet");
  }

  const meta = await commitOfflineBibleAtomic(payloads, bookList);
  const { invalidateVerseIndex } = await import("./bible/verseIndexCache");
  invalidateVerseIndex("s21");
  void import("./bible/verseSearchClient").then(({ invalidateSearchIndexInWorker }) => {
    invalidateSearchIndexInWorker("s21");
  });
  return meta;
}
