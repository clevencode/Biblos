/**
 * COOP/COEP — necessário para SharedArrayBuffer / OPFS sync access no SQLite WASM.
 *
 * Avaliação Fase 2 (Biblos) — confirmado:
 * - Build Capacitor (`CAPACITOR=1`): headers **nunca** aplicados (vite.config).
 * - Web/PWA: activar com `BIBLOS_CROSS_ORIGIN_ISOLATION=1` (dev/preview + CORP).
 * - Sem isolation: gate SQLite usa backend `idb-fallback` (memória no worker).
 * - Produção: espelhar COOP/COEP/CORP só no target web se OPFS for o default.
 */

export const CROSS_ORIGIN_ISOLATION_ENV = "BIBLOS_CROSS_ORIGIN_ISOLATION";

export const COOP_COEP_HEADERS: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export function isCrossOriginIsolationConfigured(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> })
    .env;
  return env?.[CROSS_ORIGIN_ISOLATION_ENV] === "1";
}

/** Runtime check — após headers correctos, `crossOriginIsolated` fica true. */
export function isRuntimeCrossOriginIsolated(): boolean {
  return typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
}
