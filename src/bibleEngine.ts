/**
 * Motor bíblico local (mobile): assets embutidos + IndexedDB — sem /api/youversion.
 */
import { Capacitor } from "@capacitor/core";
import {
  buildS21BookList,
  S21_BIBLE_META,
} from "./bibleS21Canon";
import type { YouVersionBook } from "./youversion/client";

export function useLocalBundledBible(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function localS21Books(): YouVersionBook[] {
  return buildS21BookList();
}

export function localS21BooksResponse() {
  return {
    ok: true,
    hasKey: true as boolean | undefined,
    bible: S21_BIBLE_META,
    books: localS21Books(),
    usingFallback: false as boolean | undefined,
    fallbackReason: null as string | null | undefined,
    error: undefined as string | undefined,
  };
}

let seedInflight: Promise<void> | null = null;

/**
 * Copia os 66 livros dos assets do APK para IndexedDB (busca + cache rápido).
 */
export function ensureBibleIndexedFromBundle(
  onProgress?: (done: number, total: number, usfm: string) => void,
): Promise<void> {
  if (!useLocalBundledBible()) return Promise.resolve();
  if (seedInflight) return seedInflight;
  seedInflight = (async () => {
    const { isOfflineBibleReady, seedOfflineBibleFromBundledAssets } = await import("./bibleOffline");
    if (await isOfflineBibleReady()) return;
    await seedOfflineBibleFromBundledAssets(localS21Books(), onProgress);
  })().finally(() => {
    seedInflight = null;
  });
  return seedInflight;
}
