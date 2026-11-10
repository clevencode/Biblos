import type { ReadingPlanEtape } from "./types";

/** Reconstrói `extractionArea` a partir do payload tipado (edição admin). */
export function serializePlanExtraction(etapes: ReadingPlanEtape[]): string {
  const sorted = [...etapes].sort((a, b) => a.order - b.order);
  const lines: string[] = [];
  for (const etape of sorted) {
    lines.push(`Étape ${etape.order} : ${etape.name}`);
    for (const jour of [...etape.jours].sort((a, b) => a.numero - b.numero)) {
      lines.push(`Jour ${jour.numero} : ${jour.passage}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
