import { extractPassageRefs } from "./planPassageRefs";

type VerseWindow = {
  bookToken: string;
  chapter: string;
  start: number | null;
  end: number | null;
};

/** Fenêtre de versets depuis une référence humaine. */
export function parseVerseWindow(passage: string): VerseWindow | null {
  const raw = String(passage || "").trim();
  if (!raw) return null;

  const human = raw.match(
    /^((?:[123]\s+)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*){0,3})\s+(\d+)(?:[.:](\d+)(?:\s*[-–—]\s*(\d+))?)?$/u,
  );
  if (human) {
    return {
      bookToken: human[1]!.trim(),
      chapter: human[2]!,
      start: human[3] ? Number(human[3]) : null,
      end: human[4] ? Number(human[4]) : human[3] ? Number(human[3]) : null,
    };
  }
  return null;
}

function countDefinedVerses(refs: string[]): number {
  let total = 0;
  for (const ref of refs) {
    const window = parseVerseWindow(ref);
    if (!window || window.start == null) continue;
    const end = window.end ?? window.start;
    total += Math.max(1, Math.abs(end - window.start) + 1);
  }
  return total;
}

/** Estimation « ~3–5 min » à partir des versets cités. */
export function formatReadingTimeLabel(refs: string[]): string | null {
  if (!refs.length) return null;
  const defined = countDefinedVerses(refs);
  const verses =
    defined > 0
      ? defined
      : refs.reduce((sum, ref) => (parseVerseWindow(ref) ? sum + 20 : sum), 0);
  if (verses <= 0) return null;
  const low = Math.max(1, Math.ceil(verses / 12));
  const high = Math.max(low + (verses > 1 && low === 1 ? 1 : 0), Math.ceil(verses / 6));
  return low === high ? `~${low} min` : `~${low}–${high} min`;
}

export function passageHasDefinedChapter(text: string | undefined | null): boolean {
  const refs = extractPassageRefs(text ?? "");
  if (refs.some((ref) => Boolean(parseVerseWindow(ref)))) return true;
  const single = refs[0];
  return Boolean(single && parseVerseWindow(single));
}
