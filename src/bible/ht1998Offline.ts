/**
 * Bible HAT98 hors ligne — assets `/bibles/ht1998.json` (sem seed IndexedDB).
 */

import { Capacitor } from "@capacitor/core";
import { requestPersistentStorage } from "../offlineStorageGuard";
import { loadHt1998Root, type Ht1998Root } from "./ht1998";
import { OFFLINE_BOOK_TOTAL } from "../bibleOffline";

const META_KEY = "ht1998";

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

export async function isHt1998OfflineReady(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return true;
  try {
    await loadHt1998Root();
    return true;
  } catch {
    return false;
  }
}

export async function readHt1998OfflineRoot(): Promise<Ht1998Root | null> {
  try {
    return await loadHt1998Root();
  } catch {
    return null;
  }
}

export async function getHt1998OfflineMeta(): Promise<Ht1998OfflineMeta | null> {
  if (!(await isHt1998OfflineReady())) return null;
  return {
    key: META_KEY,
    complete: true,
    at: Date.now(),
  };
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

/** Assets-first: aquece fetch + RAM; sem gravar IndexedDB. */
export async function downloadHt1998Offline(
  onProgress?: (p: Ht1998OfflineProgress) => void,
  signal?: AbortSignal,
): Promise<Ht1998OfflineMeta> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  void requestPersistentStorage();
  onProgress?.({ done: 0, total: 2, phase: "fetch" });
  const root = await loadHt1998Root();
  validateHt1998Root(root);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  onProgress?.({ done: 2, total: 2, phase: "store" });
  return {
    key: META_KEY,
    complete: true,
    at: Date.now(),
  };
}

export async function clearHt1998Offline(): Promise<void> {
  const { invalidateHt1998CatalogCache } = await import("./ht1998");
  invalidateHt1998CatalogCache();
}
