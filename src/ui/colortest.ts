/**
 * Destaque visual de componentes em DEV (`?colortest=BiblePassageChip:red`, vários com vírgula).
 * `?colortest=off` desliga. Sem query, usa o default abaixo.
 */
const DEV_DEFAULT = "BiblePassageChip:red";

export function bootUiColortest(): void {
  if (!import.meta.env.DEV || typeof document === "undefined") return;

  const raw = new URLSearchParams(location.search).get("colortest");
  if (raw === "0" || raw === "off") {
    delete document.documentElement.dataset.colortest;
    return;
  }

  const tokens = raw
    ? raw
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [DEV_DEFAULT];

  document.documentElement.dataset.colortest = tokens.join(" ");
}
