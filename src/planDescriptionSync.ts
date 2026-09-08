import type { ReadingPlan } from "./types";

const DESCRIPTION_PULL_MS = 20_000;

/** Aplica só a Description Notion no plano correspondente (por id ou URL). */
export function applyPlanDescription(
  plans: ReadingPlan[],
  match: { planId?: string; url?: string },
  description: string,
): { plans: ReadingPlan[]; changed: boolean } {
  const nextDescription = description ?? "";
  const index = plans.findIndex(
    (plan) =>
      (match.planId && plan.id === match.planId) ||
      (match.url && plan.url && plan.url === match.url),
  );
  if (index < 0) return { plans, changed: false };
  const prev = plans[index]!;
  if ((prev.description ?? "") === nextDescription) return { plans, changed: false };
  const next = [...plans];
  next[index] = { ...prev, description: nextDescription };
  return { plans: next, changed: true };
}

/** Puxa só a propriedade Description da página Notion do plano ativo. */
export async function pullPlanDescription(
  plans: ReadingPlan[],
  plan: ReadingPlan | null | undefined,
): Promise<{ plans: ReadingPlan[]; changed: boolean; error?: string }> {
  if (!plan?.url) return { plans, changed: false };
  try {
    const response = await fetch(`/api/description-sync?url=${encodeURIComponent(plan.url)}`);
    if (!response.ok && response.status >= 500) {
      return { plans, changed: false, error: "API de Description indisponível" };
    }
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      error?: string;
    };
    if (!response.ok || !payload.ok || typeof payload.description !== "string") {
      return { plans, changed: false, error: payload.error ?? "falha ao ler Description" };
    }
    return {
      ...applyPlanDescription(plans, { planId: plan.id, url: plan.url }, payload.description),
    };
  } catch {
    return { plans, changed: false, error: "API de Description indisponível" };
  }
}

export { DESCRIPTION_PULL_MS };
