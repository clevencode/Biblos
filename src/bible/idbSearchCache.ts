/**
 * Cache do índice de busca (verses + tokenMap) em IndexedDB nativo.
 * Sem Dexie — mesmo padrão de bibleOffline / ht1998Offline.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import type { VerseSearchIndex } from "./verseSearchEngine";

const DB_NAME = "biblos-search-index";
const DB_VERSION = 1;
const STORE = "indexes";

export type StoredSearchIndex = VerseSearchIndex & {
  key: string;
  versionId: BibleTextVersionId;
  builtAt: number;
  /** Contagem de versículos — invalidação barata. */
  sourceRevision: string;
};

export function searchIndexStorageKey(versionId: BibleTextVersionId): string {
  return `search_index_v1:${versionId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
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

export async function readSearchIndex(
  versionId: BibleTextVersionId,
): Promise<StoredSearchIndex | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const row = await idbReq(
        tx.objectStore(STORE).get(searchIndexStorageKey(versionId)) as IDBRequest<
          StoredSearchIndex | undefined
        >,
      );
      if (!row?.verses?.length || !row.tokenMap || !row.uniqueTokens) return null;
      return row;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function writeSearchIndex(
  versionId: BibleTextVersionId,
  index: VerseSearchIndex,
  sourceRevision: string,
): Promise<void> {
  const payload: StoredSearchIndex = {
    key: searchIndexStorageKey(versionId),
    versionId,
    builtAt: Date.now(),
    sourceRevision,
    verses: index.verses,
    tokenMap: index.tokenMap,
    uniqueTokens: index.uniqueTokens,
  };
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(payload);
    await idbTxDone(tx);
  } finally {
    db.close();
  }
}

export async function clearSearchIndex(
  versionId?: BibleTextVersionId,
): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      if (versionId) {
        store.delete(searchIndexStorageKey(versionId));
      } else {
        store.clear();
      }
      await idbTxDone(tx);
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}
