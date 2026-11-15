/**
 * Teste visual — força a barra de loading no bordo inferior do topbar.
 * `?topbar-loading=1` | `true` | `on`
 */
export function forceChapterTopbarLoading(): boolean {
  if (typeof location === "undefined") return false;
  try {
    const raw = new URLSearchParams(location.search).get("topbar-loading");
    return raw === "1" || raw === "true" || raw === "on";
  } catch {
    return false;
  }
}
