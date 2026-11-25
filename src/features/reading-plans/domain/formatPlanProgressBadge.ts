/**
 * Badge inline da nav de retorno no leitor (`4/5 · 5/10`).
 * Negócio: etapa só se multi-etapa; dia se o passo tiver total.
 */
export type PlanProgressBadgeInput = {
  stageIndex?: number;
  stageCount?: number;
  stageDayIndex?: number;
  stageDayCount?: number;
  stepIndex: number;
  stepCount: number;
};

export function formatPlanProgressBadge(
  input: PlanProgressBadgeInput,
): string | null {
  const stageTotal = input.stageCount ?? 1;
  const dayTotal = input.stageDayCount ?? input.stepCount ?? 0;
  const stageIdx = input.stageIndex ?? 1;
  const dayIdx = input.stageDayIndex ?? input.stepIndex + 1;

  const stageProgress = stageTotal > 1 ? `${stageIdx}/${stageTotal}` : null;
  const dayProgress = dayTotal > 0 ? `${dayIdx}/${dayTotal}` : null;
  const parts = [stageProgress, dayProgress].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
