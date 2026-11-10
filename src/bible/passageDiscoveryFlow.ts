import { isPassageBarPanelCompactTopbar } from "./passageBarPanelLayout";

/**
 * Pill (passo livro): só catálogo + referências; pesquisa de palavras no painel do ícone search.
 * `test` (default) no layout passage-bar-panel; `legacy` desliga o split.
 *
 * Preferir a função (lê o dataset do layout em runtime) — não cachear no módulo
 * do componente antes dos hooks.
 */
export function passageDiscoverySplitSearch(): boolean {
  if (!isPassageBarPanelCompactTopbar()) return false;
  const raw = String(import.meta.env.VITE_PASSAGE_DISCOVERY_FLOW ?? "test")
    .trim()
    .toLowerCase();
  return raw !== "legacy" && raw !== "0";
}
