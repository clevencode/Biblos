/**
 * Máquina de estados headless — eixos horizontal/vertical, anchor lock, cross-ref stack.
 */

import type {
  HistoryEntry,
  JumpOptions,
  NavigationDataAdapter,
  NavigationFlowEngine,
  NavigationListener,
  NavigationMode,
  NavigationStateSnapshot,
  BookManifest,
} from "../contracts/navigation.contract";
import { SlidingWindowCache } from "../cache/sliding.window";
import {
  adjacentChapterStart,
  buildManifestIndex,
  clampUsfmId,
  labelForUsfmId,
  type ManifestIndex,
} from "./manifest.resolver";
import { decodeUsfmId, encodeUsfmId } from "./usfm.codec";

export type CreateNavigationEngineOptions = {
  adapter: NavigationDataAdapter;
  manifest: BookManifest[];
  initialVersion: string;
  initialUsfmId: number;
  mode?: NavigationMode;
};

export function createNavigationFlowEngine(
  options: CreateNavigationEngineOptions,
): NavigationFlowEngine {
  const index: ManifestIndex = buildManifestIndex(options.manifest);
  const cache = new SlidingWindowCache(options.adapter);
  const listeners = new Set<NavigationListener>();

  let mode: NavigationMode = options.mode ?? "canonical";
  let version = options.initialVersion;
  let requestSequenceId = 0;
  let planSequence: number[] | undefined;
  let crossRefStack: HistoryEntry[] = [];
  let anchorUsfmId: number | null = null;

  const clamped =
    clampUsfmId(index, options.initialUsfmId) ?? options.initialUsfmId;
  let usfmId = clamped;
  let verses: NavigationStateSnapshot["verses"] = [];

  function snapshot(): NavigationStateSnapshot {
    const decoded = decodeUsfmId(usfmId);
    const book = index.byId.get(decoded.bookId);
    return {
      mode,
      version,
      usfmId,
      bookId: decoded.bookId,
      chapter: decoded.chapter,
      verse: decoded.verse,
      direction: book?.direction ?? "ltr",
      verses,
      anchorUsfmId,
      crossRefDepth: crossRefStack.length,
      requestSequenceId,
    };
  }

  function emit(): void {
    const snap = snapshot();
    for (const listener of listeners) {
      try {
        listener(snap);
      } catch {
        /* listener isolado */
      }
    }
  }

  async function loadAt(
    nextUsfmId: number,
    seq: number,
  ): Promise<boolean> {
    const target = clampUsfmId(index, nextUsfmId);
    if (target == null) return false;
    const { bookId, chapter, verse } = decodeUsfmId(target);
    const nodes = await cache.get(version, bookId, chapter);
    if (seq !== requestSequenceId) return false;
    verses = nodes;
    usfmId = encodeUsfmId(bookId, chapter, verse);
    anchorUsfmId = usfmId;
    cache.prefetchNeighbors(
      index,
      version,
      bookId,
      chapter,
      mode === "reading-plan" ? planSequence : undefined,
    );
    emit();
    return true;
  }

  // Warm inicial (fire-and-forget)
  void loadAt(usfmId, ++requestSequenceId);

  const engine: NavigationFlowEngine = {
    async jumpTo(targetUsfmId, jumpOptions?: JumpOptions) {
      const seq = ++requestSequenceId;
      if (jumpOptions?.pushHistory) {
        crossRefStack.push({
          version,
          usfmId,
          label:
            jumpOptions.label ?? labelForUsfmId(index, usfmId),
          timestamp: Date.now(),
        });
      }
      await loadAt(targetUsfmId, seq);
    },

    async stepChapter(direction) {
      const seq = ++requestSequenceId;
      const { bookId, chapter } = decodeUsfmId(usfmId);
      const next = adjacentChapterStart(
        index,
        bookId,
        chapter,
        direction,
        mode === "reading-plan" ? planSequence : undefined,
      );
      if (next == null) return;
      await loadAt(next, seq);
    },

    async switchVersion(newVersion) {
      const seq = ++requestSequenceId;
      const keep = anchorUsfmId ?? usfmId;
      version = newVersion;
      cache.invalidateVersion();
      await loadAt(keep, seq);
    },

    async popCrossReference() {
      const entry = crossRefStack.pop();
      if (!entry) return;
      const seq = ++requestSequenceId;
      version = entry.version;
      await loadAt(entry.usfmId, seq);
    },

    updateScrollAnchor(topVisibleUsfmId) {
      const clampedAnchor = clampUsfmId(index, topVisibleUsfmId);
      if (clampedAnchor == null) return;
      anchorUsfmId = clampedAnchor;
      const d = decodeUsfmId(clampedAnchor);
      const cur = decodeUsfmId(usfmId);
      if (d.bookId === cur.bookId && d.chapter === cur.chapter) {
        usfmId = clampedAnchor;
      }
      emit();
    },

    getState: snapshot,

    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },

    setMode(next) {
      mode = next;
      emit();
    },

    setReadingPlanSequence(chapterUsfmIds) {
      planSequence = [...chapterUsfmIds];
      emit();
    },
  };

  return engine;
}
