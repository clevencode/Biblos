/**
 * COOP/COEP — necessário para SharedArrayBuffer / OPFS sync access no SQLite WASM.
 *
 * Avaliação (Biblos):
 * - Build Capacitor: NÃO aplicar (WebView + Firebase auth/embeds quebram com COEP).
 * - Web/PWA: só com `BIBLOS_CROSS_ORIGIN_ISOLATION=1` no Vite (ver vite.config.ts).
 * - Produção (Vercel/host): espelhar os mesmos headers só no target web quando OPFS for adoptado.
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
