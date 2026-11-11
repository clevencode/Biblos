import { expandBibleCitations } from "../../../youversion/bibleRefs";
import { isPassageRef, toUsfm } from "../../../youversion/usfm";

/** Toutes les références bibliques d’une ligne de passage. */
export function extractPassageRefs(raw: string): string[] {
  const expanded = expandBibleCitations(String(raw || "").trim());
  if (expanded.length) return expanded;

  const cleaned = String(raw || "")
    .replace(/\*\*/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  const one = extractOnePassage(cleaned);
  return one ? [one] : [];
}

export function extractPassageRef(raw: string): string | null {
  return extractPassageRefs(raw)[0] ?? null;
}

function extractOnePassage(raw: string): string | null {
  const cleaned = String(raw || "")
    .replace(/\*\*/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (
    /^(objectif|question|semaine|comment|grande|introduction|defi|défi|texte|jour|day)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  const expanded = expandBibleCitations(cleaned);
  if (expanded.length) return expanded[0]!;
  if (isPassageRef(cleaned) && cleaned.length < 80) return cleaned;

  const match = cleaned.match(
    /(?:[123]\s+)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*){0,3}\s+\d+(?:[.:]\d+(?:\s*[-–—]\s*\d+)?)?(?:\s*[-–—]\s*\d+(?:[.:]\d+)?)?/,
  );
  if (!match) return null;
  const candidate = match[0].trim();
  if (candidate.length > 72) return null;
  if (/^(objectif|question|semaine|comment|grande|introduction|jour|day)\b/i.test(candidate)) {
    return null;
  }
  if (!isPassageRef(candidate)) return null;
  const usfm = toUsfm(candidate);
  if (!/^[A-Z0-9]{2,3}\.\d+/i.test(usfm)) return null;
  return candidate;
}
