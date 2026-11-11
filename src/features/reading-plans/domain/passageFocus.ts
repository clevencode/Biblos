import { parseUsfmParts } from "../../../youversion/client";

export function parsePassageVerseRange(passage: string): {
  verseStart: number | null;
  verseEnd: number | null;
} {
  const parts = parseUsfmParts(passage);
  const single = parts.verse ?? null;
  const range = passage.trim().match(/[.\s](\d+)\s*[-–—]\s*(\d+)\s*$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return {
        verseStart: Math.min(a, b),
        verseEnd: Math.max(a, b),
      };
    }
  }
  return {
    verseStart: single,
    verseEnd: single,
  };
}

export function passageFocusRef(passage: string): string {
  return String(passage || "").trim();
}
