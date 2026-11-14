/**
 * Bridge main thread ↔ verseSearch.worker (requestId + warm/invalidate).
 */

import type { BibleTextVersionId } from "./bibleVersions";
import type { SearchScope } from "./verseSearchEngine";
import { runLocalVerseSearch } from "./localVerseSearch";
import { scheduleSearchIndexWarmup } from "./verseIndexCache";
import type {
  WorkerInbound,
  WorkerOutbound,
  WorkerSearchResultMessage,
} from "./verseSearch.worker";
import type { BibleSearchHit } from "../youversion/client";
import type { MatchMode, SearchFacets } from "./verseSearchEngine";

export type ClientSearchOk = {
  ok: true;
  q: string;
  total: number;
  results: BibleSearchHit[];
  bookCounts: Record<string, number>;
  facets: SearchFacets;
  matchMode: MatchMode;
  matchedTerms: string[];
};

export type ClientSearchErr = { ok: false; error: string };

export type ClientSearchResult = ClientSearchOk | ClientSearchErr;

let worker: Worker | null = null;
let workerFailed = false;
let nextRequestId = 1;
/** Último search enviado — resolves obsoletos recebem unavailable sem aplicar. */
let latestSearchId = 0;

type Pending = {
  resolve: (value: ClientSearchResult) => void;
};

const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (typeof Worker === "undefined") {
    workerFailed = true;
    return null;
  }
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./verseSearch.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
      const msg = event.data;
      if (msg.type === "searchResult") {
        const wait = pending.get(msg.requestId);
        if (!wait) return;
        pending.delete(msg.requestId);
        if (!msg.ok) {
          wait.resolve({ ok: false, error: msg.error });
          return;
        }
        const ok = msg as WorkerSearchResultMessage;
        wait.resolve({
          ok: true,
          q: ok.q,
          total: ok.total,
          results: ok.results,
          bookCounts: ok.bookCounts,
          facets: ok.facets,
          matchMode: ok.matchMode,
          matchedTerms: ok.matchedTerms,
        });
        return;
      }
      if (msg.type === "error" && msg.requestId != null) {
        const wait = pending.get(msg.requestId);
        if (!wait) return;
        pending.delete(msg.requestId);
        wait.resolve({ ok: false, error: msg.message });
      }
    };
    worker.onerror = () => {
      workerFailed = true;
      for (const [, wait] of pending) {
        wait.resolve({ ok: false, error: "unavailable" });
      }
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function post(msg: WorkerInbound): void {
  getWorker()?.postMessage(msg);
}

export async function searchInWorker(input: {
  versionId: BibleTextVersionId;
  q: string;
  limit?: number;
  offset?: number;
  scope?: SearchScope;
}): Promise<ClientSearchResult> {
  const w = getWorker();
  if (!w) {
    return runLocalVerseSearch({
      version: input.versionId,
      q: input.q,
      limit: input.limit,
      offset: input.offset,
      scope: input.scope,
    });
  }

  const requestId = nextRequestId++;
  latestSearchId = requestId;
  // Liberta promises antigas (worker já não posta resultados obsoletos).
  for (const [id, wait] of pending) {
    if (id === requestId) continue;
    pending.delete(id);
    wait.resolve({ ok: false, error: "unavailable" });
  }
  return new Promise((resolve) => {
    pending.set(requestId, {
      resolve: (value) => {
        if (requestId !== latestSearchId) {
          resolve({ ok: false, error: "unavailable" });
          return;
        }
        if (!value.ok) {
          resolve({ ok: false, error: "unavailable" });
          return;
        }
        resolve(value);
      },
    });
    const msg: WorkerInbound = {
      type: "search",
      requestId,
      versionId: input.versionId,
      q: input.q,
      limit: input.limit ?? 40,
      offset: input.offset ?? 0,
      scope: input.scope,
    };
    w.postMessage(msg);
  });
}

export function warmSearchIndexInWorker(versionId: BibleTextVersionId): void {
  const w = getWorker();
  if (!w) {
    scheduleSearchIndexWarmup(versionId);
    return;
  }
  post({ type: "warm", versionId });
}

export function invalidateSearchIndexInWorker(
  versionId?: BibleTextVersionId,
): void {
  const w = getWorker();
  if (!w) {
    void import("./verseIndexCache").then(({ invalidateVerseIndex }) => {
      invalidateVerseIndex(versionId);
    });
    return;
  }
  post({ type: "invalidate", versionId });
}
