/**
 * Feature gate — SQLite WASM + FTS5 (Fase 2 zero-lag).
 * Desligado por defeito. Worker só carrega com enable explícito.
 *
 * Ativar (web): localStorage `biblos_sqlite_fts=1` ou `?sqlite-fts=1`
 * Capacitor: off (OPFS/COEP não validados no WebView).
 */

export const SQLITE_FTS_STORAGE_KEY = "biblos_sqlite_fts";
export const SQLITE_FTS_QUERY_PARAM = "sqlite-fts";

export type SqliteFtsBackend = "disabled" | "opfs" | "idb-fallback";

function readQueryFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = new URLSearchParams(window.location.search).get(
      SQLITE_FTS_QUERY_PARAM,
    );
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

function readStorageFlag(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(SQLITE_FTS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function isCapacitorRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (
    window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function isSqliteFtsEnabled(): boolean {
  if (isCapacitorRuntime()) return false;
  return readQueryFlag() || readStorageFlag();
}

export function detectSqliteFtsBackend(): SqliteFtsBackend {
  if (!isSqliteFtsEnabled()) return "disabled";
  const hasOpfs =
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof (navigator.storage as StorageManager & { getDirectory?: unknown })
      .getDirectory === "function";
  return hasOpfs ? "opfs" : "idb-fallback";
}

/** Arranque real do worker SQLite (no-op se gate off). */
export async function initSqliteFtsPrototype(): Promise<{
  ok: boolean;
  backend: SqliteFtsBackend;
  reason?: string;
}> {
  const { ensureSqliteFtsReady } = await import("./sqliteFtsClient");
  return ensureSqliteFtsReady();
}
