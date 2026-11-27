/**
 * Palavra sob o dedo no texto do leitor, sem partir os versículos em spans:
 * usa a posição do cursor de texto no ponto tocado (caretRangeFromPoint /
 * caretPositionFromPoint) e expande dentro do nó de texto.
 */

const LETTER = /[\p{L}\p{M}]/u;

export type WordSpan = { word: string; start: number; end: number };

/**
 * Palavra que contém `offset` em `text`. O apóstrofo separa contrações do
 * crioulo: em "p'ap" o lado tocado dá "p" ou "ap". O cursor fica entre
 * caracteres, por isso tenta o carácter em `offset` e depois o anterior.
 */
export function extractWordAt(text: string, offset: number): WordSpan | null {
  const s = String(text || "");
  let i = Math.max(0, Math.min(offset, s.length));
  if (!(i < s.length && LETTER.test(s[i]!))) {
    if (i > 0 && LETTER.test(s[i - 1]!)) i -= 1;
    else return null;
  }
  let start = i;
  let end = i + 1;
  while (start > 0 && LETTER.test(s[start - 1]!)) start -= 1;
  while (end < s.length && LETTER.test(s[end]!)) end += 1;
  return { word: s.slice(start, end), start, end };
}

export type WordAtPoint = WordSpan & {
  range: Range;
  verseNumber: number | null;
  verseText: string;
};

type CaretPosition = { offsetNode: Node; offset: number };

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) return { node: pos.offsetNode, offset: pos.offset };
  }
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) return { node: range.startContainer, offset: range.startOffset };
  }
  return null;
}

/** Só aceita texto dentro de `.bible-verse-text` (não números, títulos, UI). */
export function wordAtPoint(x: number, y: number): WordAtPoint | null {
  const caret = caretAt(x, y);
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return null;
  const textNode = caret.node as Text;
  const host = textNode.parentElement?.closest(".bible-verse-text");
  if (!host) return null;
  const span = extractWordAt(textNode.data, caret.offset);
  if (!span) return null;
  // O cursor pode cair no fim da linha anterior: confirma que o ponto está na palavra.
  const range = document.createRange();
  range.setStart(textNode, span.start);
  range.setEnd(textNode, span.end);
  const hit = [...range.getClientRects()].some(
    (r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2,
  );
  if (!hit) return null;
  // Versículo 1: a letra capitular vive num span à parte ("B" + "ondye").
  let word = span.word;
  const prev = textNode.previousSibling;
  if (
    span.start === 0 &&
    prev instanceof HTMLElement &&
    prev.classList.contains("bible-verse-dropcap")
  ) {
    word = `${prev.textContent ?? ""}${word}`;
    range.setStartBefore(prev);
  }
  const verseEl = host.closest<HTMLElement>("[data-verse]");
  const verseNumber = verseEl ? Number(verseEl.dataset.verse) : null;
  return {
    ...span,
    word,
    range,
    verseNumber: Number.isFinite(verseNumber) ? verseNumber : null,
    verseText: host.textContent ?? "",
  };
}
