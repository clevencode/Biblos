/**
 * Domain — parser linear (estilo Notion) → `etapes` / `jours`.
 * Sem IA : varredura linha a linha.
 */
import type { ReadingPlanEtape, ReadingPlanJour } from "./types";

export type PlanExtractionResult = {
  etapes: ReadingPlanEtape[];
  totalDays: number;
  errors: string[];
};

const ETAPE_LINE =
  /^\s*(?:\*{0,2}\s*)?(?:Étape|Etape)\s+(\d+)\s*[:：\-–—]\s*(.+?)(?:\*{0,2})?\s*$/i;

const JOUR_LINE =
  /^\s*(?:[•*]\s*)?Jour\s+(\d+)\s*(?:[:：\-–—.]|\.)\s*(.+)$/i;

function cleanLine(line: string): string {
  return line.replace(/\*+/g, "").trim();
}

export function parsePlanExtraction(extractionArea: string): PlanExtractionResult {
  const errors: string[] = [];
  const lines = String(extractionArea || "").split(/\r?\n/);

  let current: ReadingPlanEtape | null = null;
  const etapes: ReadingPlanEtape[] = [];
  const orphanJours: ReadingPlanJour[] = [];

  function pushCurrent() {
    if (!current) return;
    if (!current.jours.length) {
      errors.push(`Étape ${current.order} (« ${current.name} ») sans jours.`);
      return;
    }
    etapes.push(current);
    current = null;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (!line || /^#+\s/.test(line)) continue;

    const etapeMatch = line.match(ETAPE_LINE);
    if (etapeMatch) {
      pushCurrent();
      const order = Number(etapeMatch[1]);
      const name = cleanLine(etapeMatch[2] ?? "");
      if (!Number.isFinite(order) || order < 1 || !name) {
        errors.push(`Ligne ${i + 1} : en-tête d’étape invalide.`);
        continue;
      }
      current = { order, name, jours: [] };
      continue;
    }

    const jourMatch = line.match(JOUR_LINE);
    if (jourMatch) {
      const numero = Number(jourMatch[1]);
      const passage = cleanLine(jourMatch[2] ?? "");
      if (!Number.isFinite(numero) || numero < 1 || !passage) {
        errors.push(`Ligne ${i + 1} : jour invalide.`);
        continue;
      }
      const jour: ReadingPlanJour = { numero, passage };
      if (current) {
        current.jours.push(jour);
      } else {
        orphanJours.push(jour);
      }
      continue;
    }
  }

  pushCurrent();

  if (orphanJours.length && !etapes.length) {
    etapes.push({
      order: 1,
      name: "Plan",
      jours: orphanJours.sort((a, b) => a.numero - b.numero),
    });
  } else if (orphanJours.length) {
    errors.push(
      `${orphanJours.length} jour(s) hors étape ignoré(s) — ajoutez un « Étape N : … ».`,
    );
  }

  for (const etape of etapes) {
    etape.jours.sort((a, b) => a.numero - b.numero);
  }
  etapes.sort((a, b) => a.order - b.order);

  const allNums = etapes.flatMap((e) => e.jours.map((j) => j.numero));
  const totalDays = allNums.length ? Math.max(...allNums) : 0;

  if (!etapes.length) {
    errors.push("Aucune étape ni jour reconnu. Utilisez « Étape 1 : Titre » et « Jour 1 : … ».");
  }

  return { etapes, totalDays, errors };
}
