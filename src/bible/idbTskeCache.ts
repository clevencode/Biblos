/**
 * Cache IndexedDB dos capítulos TSKE (refs croisées) — offline-first.
 */

export type TskeChapterRecord = {
  key: string;
  bookId: string;
  chapter: number;
  data: Record<string, { heading?: string; body?: string; refs?: string[] }>;
  cachedAt: number;
};

export type TskePackMeta = {
  key: "tske_pack";
  complete: boolean;
  count: number;
  total: number;
  at: number;
};

const DB_NAME = "biblos-tske-offline";
const DB_VERSION = 1;
const STORE_CHAPTERS = "chapters";
const STORE_META = "meta";
const META_KEY = "tske_pack";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
        db.createObjectStore(STORE_CHAPTERS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb tske open failed"));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("idb tx aborted"));
  });
}

export function tskeChapterKey(bookId: string, chapter: number): string {
  return `${String(bookId).trim().toUpperCase()}.${Number(chapter)}`;
}

export async function readTskeChapter(
  bookId: string,
  chapter: number,
): Promise<TskeChapterRecord["data"] | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_CHAPTERS, "readonly");
      const row = await idbReq(
        tx.objectStore(STORE_CHAPTERS).get(
          tskeChapterKey(bookId, chapter),
        ) as IDBRequest<TskeChapterRecord | undefined>,
      );
      return row?.data && typeof row.data === "object" ? row.data : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function writeTskeChapter(
  bookId: string,
  chapter: number,
  data: TskeChapterRecord["data"],
): Promise<void> {
  const book = String(bookId).trim().toUpperCase();
  const ch = Number(chapter);
  if (!book || !Number.isFinite(ch) || !data || typeof data !== "object") return;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_CHAPTERS, "readwrite");
      tx.objectStore(STORE_CHAPTERS).put({
        key: tskeChapterKey(book, ch),
        bookId: book,
        chapter: ch,
        data,
        cachedAt: Date.now(),
      } satisfies TskeChapterRecord);
      await idbTxDone(tx);
    } finally {
      db.close();
    }
  } catch {
    /* quota / private mode — ignore */
  }
}

export async function getTskePackMeta(): Promise<TskePackMeta | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_META, "readonly");
      const row = await idbReq(
        tx.objectStore(STORE_META).get(META_KEY) as IDBRequest<
          TskePackMeta | undefined
        >,
      );
      return row ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** APK: assets embutidos. Web: manifest TSKE acessível. */
export async function isTskeOfflineReady(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch("/bible/study/tske/manifest.json");
    if (!res.ok) return false;
    const raw = (await res.text()).trim();
    if (!raw || raw.startsWith("<")) return false;
    const json = JSON.parse(raw) as { files?: string[] };
    return Array.isArray(json.files) && json.files.length > 0;
  } catch {
    return false;
  }
}

export async function writeTskePackMeta(
  count: number,
  total: number,
  complete: boolean,
): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_META, "readwrite");
      tx.objectStore(STORE_META).put({
        key: META_KEY,
        complete,
        count,
        total,
        at: Date.now(),
      } satisfies TskePackMeta);
      await idbTxDone(tx);
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}

export async function putTskeChaptersBulk(
  entries: Array<{ bookId: string; chapter: number; data: TskeChapterRecord["data"] }>,
): Promise<void> {
  if (!entries.length) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_CHAPTERS, "readwrite");
    const store = tx.objectStore(STORE_CHAPTERS);
    const at = Date.now();
    for (const entry of entries) {
      const book = String(entry.bookId).trim().toUpperCase();
      const ch = Number(entry.chapter);
      if (!book || !Number.isFinite(ch)) continue;
      store.put({
        key: tskeChapterKey(book, ch),
        bookId: book,
        chapter: ch,
        data: entry.data,
        cachedAt: at,
      } satisfies TskeChapterRecord);
    }
    await idbTxDone(tx);
  } finally {
    db.close();
  }
}
