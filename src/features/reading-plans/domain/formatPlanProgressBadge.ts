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
  const stageTotal = Math.max(1, input.stageCount ?? 1);
  const rawDayTotal = input.stageDayCount ?? input.stepCount ?? 0;
  const dayTotal = Math.max(0, rawDayTotal);
  const stageIdx = Math.min(
    Math.max(1, input.stageIndex ?? 1),
    stageTotal,
  );
  const rawDayIdx = input.stageDayIndex ?? input.stepIndex + 1;
  const dayIdx =
    dayTotal > 0
      ? Math.min(Math.max(1, rawDayIdx), dayTotal)
      : Math.max(1, rawDayIdx);

  const stageProgress = stageTotal > 1 ? `${stageIdx}/${stageTotal}` : null;
  const dayProgress = dayTotal > 0 ? `${dayIdx}/${dayTotal}` : null;
  const parts = [stageProgress, dayProgress].filter(Boolean);
  /* NBSP em volta do ponto — evita quebra/clip feio no meio do badge. */
  return parts.length ? parts.join("\u00a0·\u00a0") : null;
}
