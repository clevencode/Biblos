import type { ReadingPlan } from "./types";

export type PlanDayStep = {
  jour: number;
  passage: string;
  etapeName: string;
  etapeOrder: number;
};

/** Jours triés par `numero` (ordre canonique du plan). */
export function flattenPlanSteps(plan: ReadingPlan): PlanDayStep[] {
  const steps: PlanDayStep[] = [];
  for (const etape of [...plan.etapes].sort((a, b) => a.order - b.order)) {
    for (const jour of [...etape.jours].sort((a, b) => a.numero - b.numero)) {
      const passage = String(jour.passage || "").trim();
      if (!passage) continue;
      steps.push({
        jour: jour.numero,
        passage,
        etapeName: etape.name,
        etapeOrder: etape.order,
      });
    }
  }
  return steps.sort((a, b) => a.jour - b.jour);
}

/** Index du jour à ouvrir : 1er jour non terminé, sinon dernier jour. */
export function resolveResumeStepIndex(
  plan: ReadingPlan,
  completedJours: ReadonlySet<number> | number[],
): number {
  const steps = flattenPlanSteps(plan);
  if (!steps.length) return 0;
  const done =
    completedJours instanceof Set
      ? completedJours
      : new Set(completedJours);
  const pending = steps.findIndex((s) => !done.has(s.jour));
  return pending >= 0 ? pending : steps.length - 1;
}
