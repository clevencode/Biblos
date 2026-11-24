/**
 * Bridge main thread ↔ sqliteFts.worker (gated).
 */

import type { BibleTextVersionId } from "../bibleVersions";
import type {
  MatchMode,
  SearchFacets,
  SearchScope,
} from "../verseSearchEngine";
import type { BibleSearchHit } from "../../youversion/client";
import {
  detectSqliteFtsBackend,
  isSqliteFtsEnabled,
  type SqliteFtsBackend,
} from "./sqliteFtsGate";
import type { SqliteFtsInbound, SqliteFtsOutbound } from "./sqliteFtsTypes";
import { isRuntimeCrossOriginIsolated } from "./coopCoep";

export type SqliteSearchOk = {
  ok: true;
  q: string;
  total: number;
  results: BibleSearchHit[];
  bookCounts: Record<string, number>;
  facets: SearchFacets;
  matchMode: MatchMode;
  matchedTerms: string[];
};

export type SqliteSearchResult = SqliteSearchOk | { ok: false; error: string };

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
let initPromise: Promise<boolean> | null = null;
let activeBackend: SqliteFtsBackend = "disabled";

type Pending = {
  resolve: (value: SqliteFtsOutbound) => void;
};

const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerFailed || !isSqliteFtsEnabled()) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./sqliteFts.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<SqliteFtsOutbound>) => {
      const msg = event.data;
      const id =
        "requestId" in msg && typeof msg.requestId === "number"
          ? msg.requestId
          : undefined;
      if (id == null) return;
      const wait = pending.get(id);
      if (!wait) return;
      pending.delete(id);
      wait.resolve(msg);
    };
    worker.onerror = () => {
      workerFailed = true;
      for (const [, wait] of pending) {
        wait.resolve({
          type: "error",
          message: "sqlite_worker_failed",
        });
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

function request(msg: SqliteFtsInbound): Promise<SqliteFtsOutbound> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve({
      type: "error",
      requestId: msg.requestId,
      message: "sqlite_unavailable",
    });
  }
  return new Promise((resolve) => {
    pending.set(msg.requestId, { resolve });
    w.postMessage(msg);
  });
}

/** Inicializa o worker SQLite se o gate estiver activo. */
export async function ensureSqliteFtsReady(): Promise<{
  ok: boolean;
  backend: SqliteFtsBackend;
  reason?: string;
}> {
  if (!isSqliteFtsEnabled()) {
    return { ok: false, backend: "disabled", reason: "gate_off" };
  }
  if (initPromise) {
    const ok = await initPromise;
    return {
      ok,
      backend: activeBackend,
      reason: ok ? undefined : "init_failed",
    };
  }

  initPromise = (async () => {
    const preferOpfs =
      detectSqliteFtsBackend() === "opfs" && isRuntimeCrossOriginIsolated();
    const requestId = nextId++;
    const res = await request({
      type: "init",
      requestId,
      preferOpfs,
    });
    if (res.type === "initResult" && res.ok) {
      activeBackend = res.backend;
      return true;
    }
    if (res.type === "initResult") {
      activeBackend = res.backend;
      return false;
    }
    activeBackend = "disabled";
    return false;
  })();

  const ok = await initPromise;
  if (!ok) initPromise = null;
  return {
    ok,
    backend: activeBackend,
    reason: ok ? undefined : "init_failed",
  };
}

export async function warmSqliteFts(
  versionId: BibleTextVersionId,
): Promise<boolean> {
  const ready = await ensureSqliteFtsReady();
  if (!ready.ok) return false;
  const requestId = nextId++;
  const res = await request({ type: "warm", requestId, versionId });
  return res.type === "warmDone";
}

export function invalidateSqliteFts(versionId?: BibleTextVersionId): void {
  if (!worker || !isSqliteFtsEnabled()) return;
  const requestId = nextId++;
  worker.postMessage({
    type: "invalidate",
    requestId,
    versionId,
  } satisfies SqliteFtsInbound);
}

export async function searchInSqliteFts(input: {
  versionId: BibleTextVersionId;
  q: string;
  limit?: number;
  offset?: number;
  scope?: SearchScope;
  preferBookId?: string;
}): Promise<SqliteSearchResult | null> {
  const ready = await ensureSqliteFtsReady();
  if (!ready.ok) return null;

  const requestId = nextId++;
  const res = await request({
    type: "search",
    requestId,
    versionId: input.versionId,
    q: input.q,
    limit: input.limit ?? 40,
    offset: input.offset ?? 0,
    scope: input.scope,
    preferBookId: input.preferBookId,
  });

  if (res.type !== "searchResult") {
    return { ok: false, error: "unavailable" };
  }
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  return {
    ok: true,
    q: res.q,
    total: res.total,
    results: res.results,
    bookCounts: res.bookCounts,
    facets: res.facets,
    matchMode: res.matchMode,
    matchedTerms: res.matchedTerms,
  };
}

export function getSqliteFtsBackend(): SqliteFtsBackend {
  return activeBackend;
}
