/** Base URL des fonctions serverless (Vercel) en production. */

export function apiUrl(path: string): string {
  const p = String(path || "").replace(/^\//, "");
  if (import.meta.env.DEV) {
    return `/api/${p}`;
  }
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/api/${p}`;
}
