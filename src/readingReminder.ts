import { extractPassageRefs, sanitizePlanDays } from "./plan";
import { isPlanComplete, nextUnreadJour, type PlanProgress } from "./planProgress";
import type { ReadingPlan } from "./types";

export type DailyReadingReminder = {
  planId: string;
  planTitle: string;
  jour: number;
  totalDays: number;
  passages: string[];
  passageLabel: string;
  title: string;
  body: string;
  /** true se o plano já terminou — não agendar lembrete diário. */
  complete: boolean;
};

/**
 * Constrói a mensagem do lembrete da passagem bíblica do dia
 * (plano ativo + progresso local).
 */
export function buildDailyReadingReminder(
  plan: ReadingPlan | null | undefined,
  progress: PlanProgress | null | undefined,
): DailyReadingReminder | null {
  if (!plan?.id) return null;
  const days = sanitizePlanDays(plan.days ?? []);
  if (!days.length) return null;

  const complete = isPlanComplete({ days }, progress);
  const jour = nextUnreadJour({ ...plan, days }, progress ?? null);
  const day = days.find((item) => item.jour === jour) ?? days[0]!;
  const passages = extractPassageRefs(day.texte);
  const passageLabel =
    passages.length > 1
      ? passages.join(" · ")
      : passages[0] ?? (day.texte.trim() || "Lecture du jour");
  const planTitle = plan.theme?.trim() || plan.nome?.trim() || "Plan";

  return {
    planId: plan.id,
    planTitle,
    jour: day.jour,
    totalDays: days.length,
    passages,
    passageLabel,
    title: complete ? `${planTitle} · terminé` : `${planTitle} · Jour ${day.jour}`,
    body: complete
      ? "Tu as terminé ce plan de lecture. Bravo !"
      : `Aujourd’hui : ${passageLabel}`,
    complete,
  };
}
