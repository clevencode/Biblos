/**
 * Bible S21 hors ligne — IndexedDB (~6 Mo, 66 livres).
 * Téléchargement via /api/youversion?action=book&usfm=…
 */

import type {
  BibleSearchHit,
  YouVersionBook,
  YouVersionPassage,
  YouVersionVerse,
} from "./youversion/client";
import { toUsfm } from "./youversion/usfm";

const DB_NAME = "biblos-s21-offline";
const DB_VERSION = 1;
const STORE_BOOKS = "books";
const STORE_META = "meta";
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

function cleanVerseText(text: string): string {
  return String(text || "")
    .replace(/''/g, "'")
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

async function putBook(usfm: string, book: S21BookJson): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_BOOKS, "readwrite");
    tx.objectStore(STORE_BOOKS).put({ usfm, book });
    await idbTxDone(tx);
  } finally {
    db.close();
  }
}

async function putMeta(meta: OfflineBibleMeta): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).put(meta);
    await idbTxDone(tx);
  } finally {
    db.close();
  }
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
    const tx = db.transaction([STORE_BOOKS, STORE_META], "readwrite");
    tx.objectStore(STORE_BOOKS).clear();
    tx.objectStore(STORE_META).clear();
    await idbTxDone(tx);
  } finally {
    db.close();
  }
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
  const bookJson = await getOfflineBook(ref.book);
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

function matchRank(normText: string, queryNorm: string): number {
  if (!queryNorm) return 99;
  const esc = queryNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reWord = new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`);
  if (reWord.test(` ${normText} `)) return 0;
  if (normText.startsWith(queryNorm) || new RegExp(`(?:^|[^a-z0-9])${esc}`).test(normText)) {
    return 1;
  }
  return 2;
}

export async function offlineSearch(
  q: string,
  limit = 40,
  bookOrder?: Map<string, number>,
): Promise<{ ok: true; q: string; total: number; results: BibleSearchHit[] } | { ok: false; error: string }> {
  const query = String(q || "").trim();
  const queryNorm = normalizeSearchText(query);
  if (queryNorm.length < 2) {
    return { ok: true, q: query, total: 0, results: [] };
  }
  if (!(await isOfflineBibleReady())) {
    return { ok: false, error: "Bible hors ligne incomplete" };
  }

  const meta = await getOfflineMeta();
  const books = meta?.books ?? [];
  const order =
    bookOrder ??
    new Map(books.map((b, i) => [b.id.toUpperCase(), i]));

  const db = await openDb();
  let rows: { usfm: string; book: S21BookJson }[] = [];
  try {
    const tx = db.transaction(STORE_BOOKS, "readonly");
    rows = await idbReq(tx.objectStore(STORE_BOOKS).getAll() as IDBRequest<{ usfm: string; book: S21BookJson }[]>);
    await idbTxDone(tx);
  } finally {
    db.close();
  }

  const capped = Math.min(80, Math.max(1, Number(limit) || 40));
  type Hit = BibleSearchHit & { _rank: number; _book: number };
  const hits: Hit[] = [];

  for (const row of rows) {
    const usfm = String(row.usfm || row.book.usfm || "").toUpperCase();
    const bookTitle = row.book.title || usfm;
    for (const chapter of row.book.chapters ?? []) {
      const chapterNum = Number(chapter.chapter);
      if (!Number.isFinite(chapterNum)) continue;
      for (const verse of chapter.verses ?? []) {
        const number = Number(verse.number);
        const text = cleanVerseText(verse.text);
        if (!Number.isFinite(number) || !text) continue;
        const norm = normalizeSearchText(text);
        if (!norm.includes(queryNorm)) continue;
        hits.push({
          usfm: `${usfm}.${chapterNum}.${number}`,
          bookTitle,
          chapter: chapterNum,
          verse: number,
          text,
          snippet: makeSnippet(text, queryNorm),
          _rank: matchRank(norm, queryNorm),
          _book: order.get(usfm) ?? 999,
        });
      }
    }
  }

  hits.sort(
    (a, b) =>
      a._rank - b._rank ||
      a._book - b._book ||
      a.chapter - b.chapter ||
      a.verse - b.verse,
  );
  const results = hits.slice(0, capped).map(({ _rank, _book, ...rest }) => rest);
  return { ok: true, q: query, total: hits.length, results };
}

async function fetchBookPayload(usfm: string): Promise<S21BookJson> {
  const qs = new URLSearchParams({ action: "book", usfm });
  const res = await fetch(`/api/youversion?${qs.toString()}`);
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    book?: S21BookJson;
  };
  if (!json.ok || !json.book?.chapters) {
    throw new Error(json.error || `Échec téléchargement ${usfm}`);
  }
  return json.book;
}

/**
 * Télécharge les 66 livres S21 dans IndexedDB.
 * `signal` permet d’annuler ; relancer reprend / écrase.
 */
export async function downloadOfflineBible(
  bookList: YouVersionBook[],
  onProgress?: (p: OfflineDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<OfflineBibleMeta> {
  const list = bookList.filter((b) => b?.id);
  if (!list.length) throw new Error("Liste de livres vide");

  const total = list.length;
  let done = 0;
  const concurrency = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const index = cursor++;
      const book = list[index]!;
      const usfm = book.id.toUpperCase();
      const json = await fetchBookPayload(usfm);
      await putBook(usfm, json);
      done += 1;
      onProgress?.({ done, total, usfm });
      await putMeta({
        key: META_KEY,
        complete: false,
        count: done,
        total,
        at: Date.now(),
        books: bookList,
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()));

  const meta: OfflineBibleMeta = {
    key: META_KEY,
    complete: true,
    count: done,
    total,
    at: Date.now(),
    books: bookList,
  };
  await putMeta(meta);
  return meta;
}
