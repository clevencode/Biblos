/**
 * Motor bíblico local (mobile): assets embutidos — sem seed IndexedDB.
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

/**
 * No-op assets-first: o APK já embute os JSON; não copia para IndexedDB.
 */
export function ensureBibleIndexedFromBundle(
  _onProgress?: (done: number, total: number, usfm: string) => void,
): Promise<void> {
  return Promise.resolve();
}
