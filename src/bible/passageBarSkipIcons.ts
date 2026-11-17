import type { BiblosIconName } from "../icons/registry";

/**
 * Ícones dos FABs laterais de capítulo (SkipBack / SkipForward).
 * `chevron` → setas; default / `legacy` / `skip` → skip_previous / skip_next.
 */
export function passageBarSkipIcons(): {
  previous: BiblosIconName;
  next: BiblosIconName;
} {
  const raw = String(import.meta.env.VITE_PASSAGE_BAR_SKIP_ICONS ?? "skip")
    .trim()
    .toLowerCase();
  const useChevrons = raw === "chevron" || raw === "test";
  return useChevrons
    ? { previous: "chevron_left", next: "chevron_right" }
    : { previous: "skip_previous", next: "skip_next" };
}
