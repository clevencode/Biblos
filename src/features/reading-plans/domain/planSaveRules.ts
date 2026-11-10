import type { ReadingPlanEtape } from "./types";

export function countValidJours(etapes: ReadingPlanEtape[]): number {
  return etapes.reduce((sum, etape) => sum + etape.jours.length, 0);
}

/** Regra UX : enregistrement actif seulement si titre + ≥1 jour structuré. */
export function canPersistReadingPlan(title: string, etapes: ReadingPlanEtape[]): boolean {
  return Boolean(title.trim()) && countValidJours(etapes) >= 1;
}
