import type { PlanDay } from "./types";

/**
 * Parse le corps / propriété Plan en jours (Texte + Défi).
 * Supporte le format « Jour N : … Texte : … Défi : … ».
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
    const defiMatch = body.match(/Défi\s*:\s*([\s\S]+?)(?=\n\s*[•*]?\s*Jour\s+\d+|$)/i);
    let texte = texteMatch ? texteMatch[1].trim() : "";
    let defi = defiMatch ? defiMatch[1].trim() : body.trim();
    if (!texte && title) texte = title;
    if (texte || defi) {
      days.push({ jour, texte, defi: defi.replace(/\n+/g, " ").trim() });
    }
  }
  if (days.length) return days.sort((a, b) => a.jour - b.jour);

  const tableRe = /(?:^|\n)(\d{1,2})\s+([^\n]+?)(?=\n\d{1,2}\s+|\nQuestion|\nSemaine|\nComment|$)/g;
  while ((match = tableRe.exec(text))) {
    const jour = Number(match[1]);
    if (jour < 1 || jour > 40) continue;
    const rest = match[2].trim();
    const split = rest.match(/^(.+?)([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ].+)$/);
    days.push({
      jour,
      texte: split ? split[1].trim() : rest,
      defi: split ? split[2].trim() : "",
    });
  }
  return days.sort((a, b) => a.jour - b.jour);
}

/** Jour courant du plan selon la date de début (1-indexé, plafonné). */
export function currentPlanJour(startDate: string, totalDays: number, today = ""): number {
  if (!startDate || !totalDays) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date(`${today || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(Math.max(diff + 1, 1), totalDays);
}
