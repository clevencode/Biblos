/**
 * Trecho (snippet) de resultado de busca, alinhado ao texto original.
 *
 * A busca casa sobre o texto normalizado (sem acentos, pontuação → espaço,
 * espaços colapsados), cujo comprimento difere do original. Em vez de estimar
 * a posição por proporção, normalizamos carácter a carácter guardando o
 * offset no texto original de cada carácter normalizado.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;
const SEPARATOR = /[^\p{L}\p{N}]/u;

export type NormalizedWithOffsets = {
  /** Igual a `normalizeSearchText(raw)` (garantido pelos testes). */
  norm: string;
  /** offsets[i] = índice (UTF-16) em `raw` do carácter `norm[i]`. */
  offsets: number[];
};

export function normalizeWithOffsets(raw: string): NormalizedWithOffsets {
  const text = String(raw || "");
  let norm = "";
  const offsets: number[] = [];
  let pendingSpace = false;
  let pos = 0;
  for (const ch of text) {
    const at = pos;
    pos += ch.length;
    const base = ch.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
    for (const c of base) {
      if (SEPARATOR.test(c)) {
        pendingSpace = norm.length > 0;
        continue;
      }
      if (pendingSpace) {
        norm += " ";
        offsets.push(at);
        pendingSpace = false;
      }
      norm += c;
      for (let k = 0; k < c.length; k++) offsets.push(at);
    }
  }
  return { norm, offsets };
}

/** 1ª ocorrência no início de palavra; senão a 1ª ocorrência qualquer. */
function findNeedle(norm: string, needle: string): number {
  let first = -1;
  let idx = norm.indexOf(needle);
  while (idx >= 0) {
    if (first < 0) first = idx;
    if (idx === 0 || norm[idx - 1] === " ") return idx;
    idx = norm.indexOf(needle, idx + 1);
  }
  return first;
}

/** Recua/avança até um espaço para não cortar palavras ao meio. */
function snapStart(raw: string, start: number): number {
  if (start <= 0) return 0;
  const space = raw.lastIndexOf(" ", start);
  return space < 0 ? 0 : space + 1;
}

function snapEnd(raw: string, end: number): number {
  if (end >= raw.length) return raw.length;
  const space = raw.indexOf(" ", end);
  return space < 0 ? raw.length : space;
}

/**
 * Janela de ~`radius` caracteres em volta da 1ª ocorrência de `needleNorm`
 * (já normalizado). Sem ocorrência → início do versículo.
 */
export function makeSearchSnippet(
  text: string,
  needleNorm: string,
  radius = 60,
): string {
  const raw = String(text || "");
  const fallback = () => {
    if (raw.length <= radius * 2) return raw;
    return `${raw.slice(0, snapEnd(raw, radius * 2)).trim()}…`;
  };
  if (!needleNorm) return fallback();
  const { norm, offsets } = normalizeWithOffsets(raw);
  const idx = findNeedle(norm, needleNorm);
  if (idx < 0) return fallback();
  const hitStart = offsets[idx] ?? 0;
  const lastIdx = idx + needleNorm.length - 1;
  const hitEnd = (offsets[lastIdx] ?? hitStart) + 1;
  const start = snapStart(raw, hitStart - radius);
  const end = snapEnd(raw, hitEnd + radius);
  const slice = raw.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < raw.length ? "…" : ""}`;
}
