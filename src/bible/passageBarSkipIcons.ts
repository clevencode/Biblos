import type { BiblosIconName } from "../icons/registry";

/**
 * Ícones dos skips de capítulo na topbar (‹ · pill · ›).
 * Sempre setas (chevron) — sem ícones media skip_previous / skip_next.
 */
export function passageBarSkipIcons(): {
  previous: BiblosIconName;
  next: BiblosIconName;
} {
  return { previous: "chevron_left", next: "chevron_right" };
}
