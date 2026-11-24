/**
 * Feature gate — SQLite WASM + FTS5 (Fase 2 zero-lag).
 * Desligado por defeito. Não carrega @sqlite.org/sqlite-wasm até enable explícito.
 *
 * Ativar (web): localStorage `biblos_sqlite_fts=1` ou `?sqlite-fts=1`
 * Capacitor: manter off até validação OPFS no WebView.
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

/** Capacitor builds must not enable OPFS path without separate validation. */
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

/**
 * Ponto de entrada futuro do motor FTS.
 * Hoje: no-op tipado — o índice continua no verseSearch.worker.
 */
export async function initSqliteFtsPrototype(): Promise<{
  ok: boolean;
  backend: SqliteFtsBackend;
  reason?: string;
}> {
  const backend = detectSqliteFtsBackend();
  if (backend === "disabled") {
    return {
      ok: false,
      backend,
      reason: "gate_off",
    };
  }
  return {
    ok: false,
    backend,
    reason: "prototype_stub — wire @sqlite.org/sqlite-wasm in worker next",
  };
}
