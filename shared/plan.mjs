/**
 * Parse reading-plan markdown from Notion (Servir comme Jésus + tabular Plan property).
 * Shared by build-seed, /api/catalog and src/plan.ts.
 *
 * Étapes thématiques : `**Étape 1: Titre**` puis `Jour N: …`
 */

function strip(s) {
  return String(s ?? "").trim();
}

function parseSectionBlock(body, labelPattern) {
  const re = new RegExp(`(?:^|\\n)\\s*${labelPattern}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:Texte|Défi|Defi|Jour\\s+\\d|$))`, "i");
  const m = body.match(re);
  return m ? strip(m[1]) : "";
}

/** Jour N — … with Texte + Défi sections */
function parseJourSections(markdown) {
  const days = [];
  const re = /(?:^|\n)\s*Jour\s+(\d+)\s*(?:—|-|:)?[^\n]*\n([\s\S]*?)(?=(?:\n\s*Jour\s+\d+\s)|$)/gi;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const jour = Number(m[1]);
    const block = m[2] ?? "";
    const texte =
      parseSectionBlock(block, "Texte") ||
      parseSectionBlock(block, "Lecture") ||
      strip(block.split(/\n\s*(?:Défi|Defi)\s*:?/i)[0]);
    const defi =
      parseSectionBlock(block, "D[ée]fi") ||
      parseSectionBlock(block, "Focus") ||
      "";
    if (jour > 0 && (texte || defi)) days.push({ jour, texte, defi });
  }
  return days;
}

/** Tabular: Jour | Lecture | Focus (or Texte | Défi) */
function parseTabular(markdown) {
  const lines = markdown.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => /^jour\b/i.test(l) && /lecture|texte|focus|d[ée]fi/i.test(l));
  if (headerIdx < 0) return [];

  const header = lines[headerIdx].toLowerCase();
  const sep = (header.match(/\t/g) || []).length >= 2 ? "\t" : /\|/.test(header) ? "|" : /\s{2,}/;

  function splitRow(line) {
    if (sep === "\t") return line.split("\t").map(strip);
    if (sep === "|") return line.split("|").map(strip).filter((c) => c !== "");
    return line.split(/\s{2,}/).map(strip);
  }

  const cols = splitRow(lines[headerIdx]).map((c) => c.toLowerCase());
  const jCol = cols.findIndex((c) => /^jour/.test(c));
  const tCol = cols.findIndex((c) => /lecture|texte/.test(c));
  const dCol = cols.findIndex((c) => /focus|d[ée]fi/.test(c));
  if (jCol < 0 || tCol < 0) return [];

  const days = [];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^jour\s*\d/i.test(line) && !line.includes("\t") && !line.includes("|")) break;
    const cells = splitRow(line);
    const jour = Number(String(cells[jCol] ?? "").replace(/\D/g, ""));
    if (!jour) continue;
    const texte = strip(cells[tCol]);
    const defi = dCol >= 0 ? strip(cells[dCol]) : "";
    if (texte || defi) days.push({ jour, texte, defi });
  }
  return days;
}

/** Compact: Jour1LectureFocus rows without separators */
function parseCompactRows(markdown) {
  const days = [];
  const re = /Jour\s*(\d+)\s*([\s\S]*?)(?=Jour\s*\d+|$)/gi;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const jour = Number(m[1]);
    const chunk = strip(m[2]);
    if (!jour || !chunk) continue;
    const focusSplit = chunk.split(/Focus\s*:?\s*/i);
    if (focusSplit.length > 1) {
      days.push({ jour, texte: strip(focusSplit[0]), defi: strip(focusSplit.slice(1).join(" ")) });
      continue;
    }
    days.push({ jour, texte: chunk, defi: "" });
  }
  return days;
}

const ETAPE_HEADER_RE =
  /(?:^|\n)\s*\*{0,2}\s*[ÉE]tape\s+(\d+)\s*[:：\-–—]\s*([^*\n]+?)\s*\*{0,2}\s*(?=\n|$)/gi;

function attachStagesToDays(markdown, days) {
  if (!days?.length) return [];
  const headers = [];
  ETAPE_HEADER_RE.lastIndex = 0;
  let hm;
  while ((hm = ETAPE_HEADER_RE.exec(markdown)) !== null) {
    const id = Number(hm[1]);
    const title = String(hm[2] || "")
      .replace(/\*+/g, "")
      .trim();
    if (!Number.isFinite(id) || id < 1 || !title) continue;
    headers.push({ id, title, index: hm.index });
  }
  if (!headers.length) return [];

  for (const day of days) {
    const jourRe = new RegExp(`(?:^|\\n)\\s*[•*]?\\s*Jour\\s+${day.jour}\\s*[:：]`, "i");
    const jm = jourRe.exec(markdown);
    const pos = jm ? jm.index : -1;
    let etape;
    if (pos >= 0) {
      for (const h of headers) {
        if (h.index <= pos) etape = h.id;
      }
    }
    if (etape) day.etape = etape;
  }

  return headers
    .map((h) => {
      const stageDays = days.filter((d) => d.etape === h.id);
      if (!stageDays.length) return null;
      return {
        id: h.id,
        title: h.title,
        fromJour: stageDays[0].jour,
        toJour: stageDays[stageDays.length - 1].jour,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);
}

export function parsePlanDays(markdown) {
  const text = strip(markdown);
  if (!text) return [];

  const fromSections = parseJourSections(text);
  if (fromSections.length) return fromSections.sort((a, b) => a.jour - b.jour);

  const fromTable = parseTabular(text);
  if (fromTable.length) return fromTable.sort((a, b) => a.jour - b.jour);

  const fromCompact = parseCompactRows(text);
  if (fromCompact.length) return fromCompact.sort((a, b) => a.jour - b.jour);

  return [];
}

/** Jours + étapes thématiques Notion. */
export function parsePlanStructure(markdown) {
  const text = strip(markdown);
  if (!text) return { days: [], stages: [] };
  const days = parsePlanDays(text);
  const stages = attachStagesToDays(text, days);
  return { days, stages };
}
