import type { ReadingPlan } from "./types";
import { flattenPlanSteps } from "./planSteps";

export type PlanStageUi = {
  id: number;
  title: string;
  fromJour: number;
  toJour: number;
};

export type PlanDayUi = {
  jour: number;
  passage: string;
};

export function planDaysFromReadingPlan(plan: ReadingPlan): PlanDayUi[] {
  return flattenPlanSteps(plan).map((step) => ({
    jour: step.jour,
    passage: step.passage,
  }));
}

export function stagesFromReadingPlan(plan: ReadingPlan): PlanStageUi[] {
  const sorted = [...plan.etapes].sort((a, b) => a.order - b.order);
  const out: PlanStageUi[] = [];
  for (const etape of sorted) {
    const nums = etape.jours.map((j) => j.numero).sort((a, b) => a - b);
    if (!nums.length) continue;
    out.push({
      id: etape.order,
      title: etape.name.trim() || `Étape ${etape.order}`,
      fromJour: nums[0]!,
      toJour: nums[nums.length - 1]!,
    });
  }
  return out;
}

export function stageForJour(stages: PlanStageUi[], jour: number): PlanStageUi | undefined {
  return stages.find((s) => jour >= s.fromJour && jour <= s.toJour);
}
