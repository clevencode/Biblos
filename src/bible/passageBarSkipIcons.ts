import type { BiblosIconName } from "../icons/registry";

/**
 * Setas capítulo anterior/seguinte na barra topo (`bible-yv-top-passage-arrow`).
 * `test` (default) → chevrons; `legacy` → skip back/forward.
 */
export function passageBarSkipIcons(): {
  previous: BiblosIconName;
  next: BiblosIconName;
} {
  const raw = String(import.meta.env.VITE_PASSAGE_BAR_SKIP_ICONS ?? "test")
    .trim()
    .toLowerCase();
  const useChevrons = raw !== "legacy" && raw !== "skip" && raw !== "0";
  return useChevrons
    ? { previous: "chevron_left", next: "chevron_right" }
    : { previous: "skip_previous", next: "skip_next" };
}
