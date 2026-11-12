/**
 * Bible HAT98 hors ligne — un seul JSON (~8 Mo) en IndexedDB.
 */

import {
  isQuotaExceededError,
  requestPersistentStorage,
} from "../offlineStorageGuard";
import { HT1998_JSON_URL, type Ht1998Root } from "./ht1998";
import { OFFLINE_BOOK_TOTAL } from "../bibleOffline";

const DB_NAME = "biblos-ht-offline";
const DB_VERSION = 2;
const STORE_META = "meta";
const STORE_ROOT = "root";
const META_KEY = "ht1998";
const ROOT_KEY = "catalog";

export type Ht1998OfflineMeta = {
  key: typeof META_KEY;
  complete: boolean;
  at: number;
  bytes?: number;
};

export type Ht1998OfflineProgress = {
  done: number;
  total: number;
  phase: "fetch" | "store";
};

function assertStores(db: IDBDatabase) {
  if (
    !db.objectStoreNames.contains(STORE_META) ||
    !db.objectStoreNames.contains(STORE_ROOT)
  ) {
    throw new Error("IDB_SCHEMA_MISSING");
  }
}

function deleteHtDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("IndexedDB delete failed"));
    req.onblocked = () => resolve();
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponible"));
    req.onsuccess = () => {
      try {
        assertStores(req.result);
        resolve(req.result);
      } catch (err) {
        req.result.close();
        reject(err);
      }
    };
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_ROOT)) {
        db.createObjectStore(STORE_ROOT, { keyPath: "key" });
      }
    };
  });
}

function isSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg === "IDB_SCHEMA_MISSING" ||
    msg.includes("object stores was not found") ||
    msg.includes("NotFoundError")
  );
}

function friendlyIdbError(err: unknown): Error {
  if (isSchemaError(err)) {
    return new Error(
      "Espace de stockage local invalide. Touchez « Réessayer » pour retélécharger.",
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function runWithDb<T>(work: (db: IDBDatabase) => Promise<T>): Promise<T> {
  let retried = false;
  while (true) {
    try {
      const db = await openDb();
      try {
        return await work(db);
      } finally {
        db.close();
      }
    } catch (err) {
      if (!retried && isSchemaError(err)) {
        retried = true;
        await deleteHtDb();
        continue;
      }
      throw friendlyIdbError(err);
    }
  }
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

export async function getHt1998OfflineMeta(): Promise<Ht1998OfflineMeta | null> {
  try {
    return await runWithDb(async (db) => {
      const tx = db.transaction(STORE_META, "readonly");
      const row = await idbReq(
        tx.objectStore(STORE_META).get(META_KEY) as IDBRequest<Ht1998OfflineMeta | undefined>,
      );
      await idbTxDone(tx);
      return row ?? null;
    });
  } catch {
    return null;
  }
}

export async function isHt1998OfflineReady(): Promise<boolean> {
  const meta = await getHt1998OfflineMeta();
  return Boolean(meta?.complete);
}

export async function readHt1998OfflineRoot(): Promise<Ht1998Root | null> {
  try {
    return await runWithDb(async (db) => {
      const tx = db.transaction(STORE_ROOT, "readonly");
      const row = await idbReq(
        tx.objectStore(STORE_ROOT).get(ROOT_KEY) as IDBRequest<
          { key: string; root: Ht1998Root } | undefined
        >,
      );
      await idbTxDone(tx);
      if (!row?.root?.books?.length) return null;
      return row.root;
    });
  } catch {
    return null;
  }
}

export function validateHt1998Root(root: Ht1998Root | null | undefined): Ht1998Root {
  if (!root?.books?.length) {
    throw new Error("Catalogue haïtien vide");
  }
  if (root.books.length < OFFLINE_BOOK_TOTAL) {
    throw new Error("Catalogue haïtien incomplet");
  }
  for (const book of root.books) {
    const usfm = String(book?.usfm || "").trim();
    if (!usfm) throw new Error("Catalogue haïtien invalide");
    const chapters = book.chapters;
    if (!Array.isArray(chapters) || chapters.length === 0) {
      throw new Error(`Données invalides: ${usfm}`);
    }
    const hasVerse = chapters.some(
      (ch) =>
        Array.isArray(ch.verses) &&
        ch.verses.some((v) => String(v?.text || "").trim()),
    );
    if (!hasVerse) throw new Error(`Données invalides: ${usfm}`);
  }
  return root;
}

export async function downloadHt1998Offline(
  onProgress?: (p: Ht1998OfflineProgress) => void,
  signal?: AbortSignal,
): Promise<Ht1998OfflineMeta> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  await requestPersistentStorage();

  onProgress?.({ done: 0, total: 2, phase: "fetch" });
  let root: Ht1998Root;
  try {
    const res = await fetch(HT1998_JSON_URL, { signal });
    if (!res.ok) throw new Error("Traduction haïtienne indisponible");
    root = validateHt1998Root((await res.json()) as Ht1998Root);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (isQuotaExceededError(err)) {
      throw new Error("Espace de stockage insuffisant pour la Bible hors ligne");
    }
    throw err instanceof Error ? err : new Error("Traduction haïtienne indisponible");
  }

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  onProgress?.({ done: 1, total: 2, phase: "store" });
  const bytes = new Blob([JSON.stringify(root)]).size;

  try {
    return await runWithDb(async (db) => {
      const tx = db.transaction([STORE_ROOT, STORE_META], "readwrite");
      tx.objectStore(STORE_ROOT).put({ key: ROOT_KEY, root });
      const meta: Ht1998OfflineMeta = {
        key: META_KEY,
        complete: true,
        at: Date.now(),
        bytes,
      };
      tx.objectStore(STORE_META).put(meta);
      await idbTxDone(tx);
      onProgress?.({ done: 2, total: 2, phase: "store" });
      return meta;
    });
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw new Error("Espace de stockage insuffisant pour la Bible hors ligne");
    }
    throw err;
  }
}

export async function clearHt1998Offline(): Promise<void> {
  try {
    await runWithDb(async (db) => {
      const tx = db.transaction([STORE_ROOT, STORE_META], "readwrite");
      tx.objectStore(STORE_ROOT).delete(ROOT_KEY);
      tx.objectStore(STORE_META).delete(META_KEY);
      await idbTxDone(tx);
    });
  } catch (err) {
    if (isSchemaError(err)) {
      await deleteHtDb();
      return;
    }
    throw friendlyIdbError(err);
  }
}
