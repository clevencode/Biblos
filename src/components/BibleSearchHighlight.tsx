import type { ReactNode } from "react";

export function normalizeForHighlight(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Surligne le match même si accents / casse diffèrent (être ↔ etre). */
export function BibleSearchHighlight({
  text,
  query,
  markClassName = "bible-search-mark",
}: {
  text: string;
  query: string;
  markClassName?: string;
}) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const normQ = normalizeForHighlight(q);
  if (normQ.length < 2) return <>{text}</>;

  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const restNorm = normalizeForHighlight(rest);
    const at = restNorm.indexOf(normQ);
    if (at < 0) {
      nodes.push(<span key={key++}>{rest}</span>);
      break;
    }
    let rawStart = 0;
    let normCount = 0;
    while (rawStart < rest.length && normCount < at) {
      const ch = rest[rawStart]!;
      const n = normalizeForHighlight(ch);
      if (n) normCount += n.length;
      rawStart += 1;
    }
    let rawEnd = rawStart;
    let matched = 0;
    while (rawEnd < rest.length && matched < normQ.length) {
      const ch = rest[rawEnd]!;
      const n = normalizeForHighlight(ch);
      if (n) matched += n.length;
      rawEnd += 1;
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
