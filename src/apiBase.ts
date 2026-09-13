import { Capacitor } from "@capacitor/core";

/** Origine de production (APIs Vercel) pour l’APK Capacitor bundlé. */
export const PROD_ORIGIN = "https://biblos-two.vercel.app";

/**
 * Résout une URL `/api/…` pour le WebView natif.
 * En APK sans `server.url`, l’origine est `https://localhost` — les chemins
 * relatifs échouent et l’app croit être hors ligne malgré le réseau.
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return normalized;
  if (!Capacitor.isNativePlatform()) return normalized;

  const { hostname, origin } = window.location;
  if (hostname.endsWith("vercel.app") || origin === PROD_ORIGIN) {
    return normalized;
  }

  return `${PROD_ORIGIN}${normalized}`;
}

/**
 * Lit un JSON d’API sans exiger `Content-Type` (CapacitorHttp / proxies
 * peuvent omettre ou casser le header — ce qui bloquait le sync catalogue).
 */
export async function readApiJson<T = unknown>(
  response: Response,
): Promise<{ ok: boolean; data: T | null }> {
  const raw = await response.text();
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, data: null };

  const ct = (
    response.headers.get("content-type") ||
    response.headers.get("Content-Type") ||
    ""
  ).toLowerCase();
  const looksJson =
    ct.includes("application/json") ||
    ct.includes("+json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");
  if (!looksJson) return { ok: false, data: null };

  try {
    return { ok: true, data: JSON.parse(trimmed) as T };
  } catch {
    return { ok: false, data: null };
  }
}
