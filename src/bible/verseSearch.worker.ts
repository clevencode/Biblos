/// <reference lib="webworker" />
/**
 * Web Worker — montagem de índice + searchVersesCascade fora da main thread.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import { ensureVerseIndex, invalidateVerseIndex } from "./verseIndexCache";
import { runLocalVerseSearch } from "./localVerseSearch";
import type { SearchScope } from "./verseSearchEngine";

export type WorkerSearchRequest = {
  type: "search";
  requestId: number;
  versionId: BibleTextVersionId;
  q: string;
  limit: number;
  scope?: SearchScope;
};

export type WorkerWarmRequest = {
  type: "warm";
  versionId: BibleTextVersionId;
};

export type WorkerInvalidateRequest = {
  type: "invalidate";
  versionId?: BibleTextVersionId;
};

export type WorkerInbound =
  | WorkerSearchRequest
  | WorkerWarmRequest
  | WorkerInvalidateRequest;

export type WorkerSearchResultMessage = {
  type: "searchResult";
  requestId: number;
  ok: true;
  q: string;
  total: number;
  results: import("../youversion/client").BibleSearchHit[];
  bookCounts: Record<string, number>;
  facets: import("./verseSearchEngine").SearchFacets;
  matchMode: import("./verseSearchEngine").MatchMode;
  matchedTerms: string[];
};

export type WorkerSearchErrorMessage = {
  type: "searchResult";
  requestId: number;
  ok: false;
  error: string;
};

export type WorkerWarmDoneMessage = {
  type: "warmDone";
  versionId: BibleTextVersionId;
};

export type WorkerErrorMessage = {
  type: "error";
  requestId?: number;
  message: string;
};

export type WorkerOutbound =
  | WorkerSearchResultMessage
  | WorkerSearchErrorMessage
  | WorkerWarmDoneMessage
  | WorkerErrorMessage;

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;
  void (async () => {
    try {
      if (msg.type === "invalidate") {
        invalidateVerseIndex(msg.versionId);
        return;
      }
      if (msg.type === "warm") {
        await ensureVerseIndex(msg.versionId);
        const out: WorkerWarmDoneMessage = {
          type: "warmDone",
          versionId: msg.versionId,
        };
        ctx.postMessage(out);
        return;
      }
      if (msg.type === "search") {
        const found = await runLocalVerseSearch({
          version: msg.versionId,
          q: msg.q,
          limit: msg.limit,
          scope: msg.scope ?? { type: "all" },
        });
        if (!found.ok) {
          const err: WorkerSearchErrorMessage = {
            type: "searchResult",
            requestId: msg.requestId,
            ok: false,
            error: found.error,
          };
          ctx.postMessage(err);
          return;
        }
        const ok: WorkerSearchResultMessage = {
          type: "searchResult",
          requestId: msg.requestId,
          ok: true,
          q: found.q,
          total: found.total,
          results: found.results,
          bookCounts: found.bookCounts,
          facets: found.facets,
          matchMode: found.matchMode,
          matchedTerms: found.matchedTerms,
        };
        ctx.postMessage(ok);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur de recherche (worker)";
      const out: WorkerErrorMessage = {
        type: "error",
        requestId: msg.type === "search" ? msg.requestId : undefined,
        message,
      };
      ctx.postMessage(out);
    }
  })();
};
