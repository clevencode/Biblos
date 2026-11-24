/**
 * Sliding window N±1 — cache em memória de passagens já resolvidas.
 * Main thread só lê; prefetch dispara load assíncrono sem bloquear paint.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import type { PassageViewState } from "./viewState/types";
import { adjacentChapter, chapterUsfm } from "../youversion/client";
import type { YouVersionBook } from "../youversion/client";
import { loadPassageViewState } from "./passageRepository";

const MAX_ENTRIES = 12;

type CacheKey = string;

type Entry = {
  state: Extract<PassageViewState, { status: "success" }>;
  touched: number;
};

const cache = new Map<CacheKey, Entry>();
const inflight = new Map<CacheKey, Promise<PassageViewState>>();

function keyOf(
  version: BibleTextVersionId,
  bookId: string,
  chapterId: string,
): CacheKey {
  return `${version}::${chapterUsfm(bookId, chapterId)}`;
}

function touch(key: CacheKey, entry: Entry): void {
  entry.touched = Date.now();
  cache.set(key, entry);
  if (cache.size <= MAX_ENTRIES) return;
  let oldestKey: CacheKey | null = null;
  let oldest = Infinity;
  for (const [k, v] of cache) {
    if (v.touched < oldest) {
      oldest = v.touched;
      oldestKey = k;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function peekPassageWindow(
  version: BibleTextVersionId,
  bookId: string,
  chapterId: string,
): Extract<PassageViewState, { status: "success" }> | null {
  const hit = cache.get(keyOf(version, bookId, chapterId));
  if (!hit) return null;
  touch(keyOf(version, bookId, chapterId), hit);
  return hit.state;
}

export function putPassageWindow(
  version: BibleTextVersionId,
  bookId: string,
  chapterId: string,
  state: PassageViewState,
): void {
  if (state.status !== "success") return;
  touch(keyOf(version, bookId, chapterId), {
    state,
    touched: Date.now(),
  });
}

export function invalidatePassageWindow(version?: BibleTextVersionId): void {
  if (!version) {
    cache.clear();
    inflight.clear();
    return;
  }
  const prefix = `${version}::`;
  for (const k of [...cache.keys()]) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
  for (const k of [...inflight.keys()]) {
    if (k.startsWith(prefix)) inflight.delete(k);
  }
}

type PrefetchOpts = {
  version: BibleTextVersionId;
  books: YouVersionBook[];
  bookId: string;
  chapterId: string;
  resolveBookTitle: (bookId: string) => string;
  catalogOffline: boolean;
  offlineIndexReady: boolean;
};

async function loadOne(
  opts: PrefetchOpts,
  bookId: string,
  chapterId: string,
): Promise<PassageViewState> {
  const key = keyOf(opts.version, bookId, chapterId);
  const cached = cache.get(key);
  if (cached) {
    touch(key, cached);
    return cached.state;
  }
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = loadPassageViewState({
    version: opts.version,
    bookId,
    chapterId,
    bookTitle: opts.resolveBookTitle(bookId),
    catalogOffline: opts.catalogOffline,
    offlineIndexReady: opts.offlineIndexReady,
  }).then((state) => {
    inflight.delete(key);
    putPassageWindow(opts.version, bookId, chapterId, state);
    return state;
  });
  inflight.set(key, promise);
  return promise;
}

/** Prefetch silencioso dos vizinhos N−1 e N+1 (idle / microtask). */
export function prefetchAdjacentPassages(opts: PrefetchOpts): void {
  const run = () => {
    for (const delta of [-1, 1] as const) {
      const next = adjacentChapter(
        opts.books,
        opts.bookId,
        opts.chapterId,
        delta,
      );
      if (!next) continue;
      void loadOne(opts, next.bookId, next.chapterId);
    }
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => run(), { timeout: 1200 });
  } else {
    setTimeout(run, 0);
  }
}
