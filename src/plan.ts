import type { PlanDay } from "./types";
import { isPassageRef, toUsfm } from "./youversion/usfm";

/**
 * Parse le corps / propriété Plan en jours (Texte + Défi).
 * Ne garde que les jours avec une vraie référence de verset.
 * Plusieurs chapitres le même jour : « Ésaïe 6 ; Ésaïe 7 ; Ésaïe 8 ».
 */
export function parsePlanDays(raw: string): PlanDay[] {
  const text = String(raw || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "");
  const days: PlanDay[] = [];
  const jourRe =
    /(?:^|\n)\s*[•*]?\s*Jour\s+(\d+)\s*[:：]\s*([^\n]*)([\s\S]*?)(?=(?:\n\s*[•*]?\s*Jour\s+\d+\s*[:：])|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = jourRe.exec(text))) {
    const jour = Number(match[1]);
    const title = (match[2] || "").trim();
    const body = match[3] || "";
    const texteMatch = body.match(/Texte\s*:\s*([^\n]+)/i);
    const defiMatch = body.match(/Défi\s*:\s*([^\n]+)/i);
    let texte = texteMatch ? texteMatch[1].trim() : "";
    const defi = defiMatch ? defiMatch[1].trim() : "";
    if (!texte && title) texte = title;
    const passage = joinPassageRefs(`${texte} ${defi} ${title}`);
    if (!passage) continue;
    days.push({ jour, texte: passage, defi: "" });
  }
  if (days.length) return uniqueByJour(days);

  // Compact Notion : « 1**Ésaïe 6:1-8**Le Trône… »
  const compactRe =
    /(\d{1,2})\s*\*\*([^*]+)\*\*\s*([\s\S]*?)(?=(?:\d{1,2}\s*\*\*)|Question de méditation|Semaine|Comment utiliser|Objectif|Jour\s+\d|$)/gi;
  while ((match = compactRe.exec(text))) {
    const jour = Number(match[1]);
    if (jour < 1 || jour > 40) continue;
    const passage = joinPassageRefs(match[2] || "");
    if (!passage) continue;
    days.push({ jour, texte: passage, defi: "" });
  }
  if (days.length) return uniqueByJour(days);

  // Tableau compact : « 3 **Ézéchiel 1:1-28** Focus… »
  const tableRe =
    /(?:^|\n)(\d{1,2})\s+\*{0,2}((?:[123]\s+)?[A-Za-zÀ-ÿ][^*\n]{2,80}?\d+(?:[.:]\d+(?:\s*[-–—]\s*\d+)?)?)\*{0,2}\s*([^\n]*)/g;
  while ((match = tableRe.exec(text))) {
    const jour = Number(match[1]);
    if (jour < 1 || jour > 40) continue;
    const passage = joinPassageRefs(match[2] || "");
    if (!passage) continue;
    days.push({ jour, texte: passage, defi: "" });
  }
  return uniqueByJour(days);
}

function uniqueByJour(days: PlanDay[]): PlanDay[] {
  const byJour = new Map<number, PlanDay>();
  for (const day of days) {
    if (!byJour.has(day.jour)) byJour.set(day.jour, day);
  }
  return [...byJour.values()].sort((a, b) => a.jour - b.jour);
}

/** Ne garde que les jours avec une référence biblique valide (multi-chapitres OK). */
export function sanitizePlanDays(days: PlanDay[] | null | undefined): PlanDay[] {
  if (!days?.length) return [];
  const out: PlanDay[] = [];
  for (const day of days) {
    const passage = joinPassageRefs(day.texte) || joinPassageRefs(day.defi);
    if (!passage) continue;
    out.push({ jour: day.jour, texte: passage, defi: "" });
  }
  return uniqueByJour(out);
}

const PASSAGE_SPLIT = /\s*(?:[;•·|]|\n|\/)\s*/;

/** Toutes les références bibliques d’une ligne (Ésaïe 6 ; Ésaïe 7). */
export function extractPassageRefs(raw: string): string[] {
  const cleaned = String(raw || "")
    .replace(/\*\*/g, " ")
    .replace(/<[^>]+>/g, " ")
    .trim();
  if (!cleaned) return [];
  const chunks = cleaned
    .split(PASSAGE_SPLIT)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks.length ? chunks : [cleaned.replace(/\s+/g, " ").trim()]) {
    const one = extractOnePassage(chunk);
    if (!one) continue;
    const key = one.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(one);
  }
  return out;
}

function joinPassageRefs(raw: string): string | null {
  const refs = extractPassageRefs(raw);
  return refs.length ? refs.join(" ; ") : null;
}

/** Extrait une référence biblique courte (Ésaïe 6:1-8, Jean 3.16, …). */
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

/** Jour courant du plan selon la date de début (1-indexé, plafonné). */
export function currentPlanJour(startDate: string, totalDays: number, today = ""): number {
  if (!startDate || !totalDays) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date(`${today || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(Math.max(diff + 1, 1), totalDays);
}
