/**
 * Pill do topo: livro + capítulo num só segmento (teste UX).
 * `?passage-pill=test` | `unified` — default em DEV.
 * `?passage-pill=legacy` | `off` — dois chips separados.
 */
const PARAM = "passage-pill";

export function bootPassagePillLayoutTest(): void {
  if (!import.meta.env.DEV || typeof document === "undefined") return;

  const raw = new URLSearchParams(location.search).get(PARAM);
  if (raw === "0" || raw === "off" || raw === "legacy") {
    delete document.documentElement.dataset.passagePill;
    return;
  }

  if (raw === "test" || raw === "unified" || raw == null) {
    document.documentElement.dataset.passagePill = "unified";
    return;
  }

  document.documentElement.dataset.passagePill = raw.trim();
}

export function isPassagePillUnified(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.passagePill === "unified";
}

/** Rótulo compacto no pill — espelha o hero « livre + chapitre ». */
export function formatPassagePillRef(bookTitle: string, chapterId: string): string {
  const book = String(bookTitle ?? "").trim();
  const ch = String(chapterId ?? "").trim();
  if (book && ch) return `${book} ${ch}`;
  return book || ch;
}
