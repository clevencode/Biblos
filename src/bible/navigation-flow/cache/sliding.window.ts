/**
 * Cache LRU de 3 slots [N-1, N, N+1] + prefetch silencioso via adapter.
 */

import type {
  NavigationDataAdapter,
  VerseNode,
} from "../contracts/navigation.contract";
import type { ManifestIndex } from "../core/manifest.resolver";
import { adjacentChapterStart } from "../core/manifest.resolver";
import { decodeUsfmId } from "../core/usfm.codec";

type SlotKey = string;

function keyOf(version: string, bookId: number, chapter: number): SlotKey {
  return `${version}::${bookId}.${chapter}`;
}

export class SlidingWindowCache {
  private readonly slots = new Map<SlotKey, VerseNode[]>();
  private readonly inflight = new Map<SlotKey, Promise<VerseNode[]>>();
  private readonly maxSlots = 5;

  constructor(private readonly adapter: NavigationDataAdapter) {}

  peek(
    version: string,
    bookId: number,
    chapter: number,
  ): VerseNode[] | null {
    return this.slots.get(keyOf(version, bookId, chapter)) ?? null;
  }

  async get(
    version: string,
    bookId: number,
    chapter: number,
  ): Promise<VerseNode[]> {
    const k = keyOf(version, bookId, chapter);
    const hit = this.slots.get(k);
    if (hit) {
      this.touch(k, hit);
      return hit;
    }
    const pending = this.inflight.get(k);
    if (pending) return pending;

    const promise = this.adapter
      .fetchChapter(version, bookId, chapter)
      .then((verses) => {
        this.inflight.delete(k);
        this.touch(k, verses);
        return verses;
      })
      .catch((err) => {
        this.inflight.delete(k);
        throw err;
      });
    this.inflight.set(k, promise);
    return promise;
  }

  /** Prefetch N±1 em idle / microtask. */
  prefetchNeighbors(
    index: ManifestIndex,
    version: string,
    bookId: number,
    chapter: number,
    planSequence?: number[],
  ): void {
    const run = () => {
      for (const dir of ["prev", "next"] as const) {
        const next = adjacentChapterStart(
          index,
          bookId,
          chapter,
          dir,
          planSequence,
        );
        if (!next) continue;
        const d = decodeUsfmId(next);
        void this.get(version, d.bookId, d.chapter).catch(() => undefined);
      }
    };
    if (typeof setTimeout === "function") setTimeout(run, 0);
    else run();
  }

  invalidateVersion(version?: string): void {
    if (!version) {
      this.slots.clear();
      this.inflight.clear();
      return;
    }
    const prefix = `${version}::`;
    for (const k of [...this.slots.keys()]) {
      if (k.startsWith(prefix)) this.slots.delete(k);
    }
    for (const k of [...this.inflight.keys()]) {
      if (k.startsWith(prefix)) this.inflight.delete(k);
    }
  }

  private touch(k: SlotKey, verses: VerseNode[]): void {
    this.slots.delete(k);
    this.slots.set(k, verses);
    while (this.slots.size > this.maxSlots) {
      const oldest = this.slots.keys().next().value;
      if (oldest != null) this.slots.delete(oldest);
      else break;
    }
  }
}
