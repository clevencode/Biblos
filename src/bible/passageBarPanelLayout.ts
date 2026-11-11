/**
 * BiblePassageBar (test): padrão chip + dropdown desanexado.
 * - Hit targets = `--mobile-touch` (44px); search/☰ ghost; chip com superfície.
 * - Setas capítulo no FAB inf. direito (ex-hamburger); play FAB = mesmo touch size.
 * - Painel como cartão (offset `--mobile-chrome-gap`), não “pergaminho” colado.
 * - Layout split (test): ícone search + chip; hamburger topo direita; skips FAB inf. direito.
 * - Aberto: caret ↑; 2.º clique no chip fecha o painel.
 *
 * `test` (default) — `?passage-bar-panel=legacy` | `off` (DEV) ou `VITE_PASSAGE_BAR_PANEL_LAYOUT=legacy`.
 */
const PARAM = "passage-bar-panel";
const DATA = "passageBarPanel";
const TEST_VALUE = "test";

export function bootPassageBarPanelLayout(): void {
  if (typeof document === "undefined") return;

  if (import.meta.env.DEV) {
    const fromUrl = new URLSearchParams(location.search).get(PARAM);
    if (fromUrl === "0" || fromUrl === "off" || fromUrl === "legacy") {
      delete document.documentElement.dataset[DATA];
      return;
    }
    if (
      fromUrl === "test" ||
      fromUrl === "compact" ||
      fromUrl === "compact-topbar" ||
      fromUrl == null
    ) {
      document.documentElement.dataset[DATA] = TEST_VALUE;
      return;
    }
  }

  const fromEnv = String(import.meta.env.VITE_PASSAGE_BAR_PANEL_LAYOUT ?? "test")
    .trim()
    .toLowerCase();
  if (fromEnv === "legacy" || fromEnv === "0" || fromEnv === "off") {
    delete document.documentElement.dataset[DATA];
    return;
  }
  document.documentElement.dataset[DATA] = TEST_VALUE;
}

export function isPassageBarPanelCompactTopbar(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset[DATA] === TEST_VALUE;
}
