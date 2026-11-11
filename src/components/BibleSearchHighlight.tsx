import type { ReactNode } from "react";

export function normalizeForHighlight(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function collectHighlightTerms(query: string, matchedTerms?: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const n = normalizeForHighlight(raw).trim();
    if (n.length < 2 || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  for (const term of matchedTerms ?? []) add(term);
  const q = query.trim();
  if (q) {
    add(q);
    for (const part of normalizeForHighlight(q).split(/\s+/)) add(part);
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

function findEarliestTerm(
  restNorm: string,
  terms: string[],
): { at: number; term: string } | null {
  let bestAt = -1;
  let bestTerm = "";
  for (const term of terms) {
    const at = restNorm.indexOf(term);
    if (at < 0) continue;
    if (
      bestAt < 0 ||
      at < bestAt ||
      (at === bestAt && term.length > bestTerm.length)
    ) {
      bestAt = at;
      bestTerm = term;
    }
  }
  if (bestAt < 0) return null;
  return { at: bestAt, term: bestTerm };
}

function mapNormSpanToRaw(
  rest: string,
  normStart: number,
  normLen: number,
): { rawStart: number; rawEnd: number } {
  let rawStart = 0;
  let normCount = 0;
  while (rawStart < rest.length && normCount < normStart) {
    const ch = rest[rawStart]!;
    const n = normalizeForHighlight(ch);
    if (n) normCount += n.length;
    rawStart += 1;
  }
  let rawEnd = rawStart;
  let matched = 0;
  while (rawEnd < rest.length && matched < normLen) {
    const ch = rest[rawEnd]!;
    const n = normalizeForHighlight(ch);
    if (n) matched += n.length;
    rawEnd += 1;
  }
  return { rawStart, rawEnd };
}

/** Surligne le match même si accents / casse / radical / fuzzy diffèrent. */
export function BibleSearchHighlight({
  text,
  query,
  matchedTerms,
  markClassName = "bible-search-mark",
}: {
  text: string;
  query: string;
  matchedTerms?: string[];
  markClassName?: string;
}) {
  const terms = collectHighlightTerms(query, matchedTerms);
  if (terms.length === 0) return <>{text}</>;

  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const restNorm = normalizeForHighlight(rest);
    const hit = findEarliestTerm(restNorm, terms);
    if (!hit) {
      nodes.push(<span key={key++}>{rest}</span>);
      break;
    }
    const { rawStart, rawEnd } = mapNormSpanToRaw(rest, hit.at, hit.term.length);
    if (rawEnd <= rawStart) {
      nodes.push(<span key={key++}>{rest}</span>);
      break;
    }
    if (rawStart > 0) {
      nodes.push(<span key={key++}>{rest.slice(0, rawStart)}</span>);
    }
    nodes.push(
      <mark key={key++} className={markClassName}>
        {rest.slice(rawStart, rawEnd)}
      </mark>,
    );
    i += rawEnd;
  }
  return <>{nodes}</>;
}
