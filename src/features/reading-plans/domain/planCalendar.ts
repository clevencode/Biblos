import type { ReadingPlan } from "./types";
import type { PlanProgress } from "./planProgress";
import { flattenPlanSteps } from "./planSteps";

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey(): string {
  return dateKey(new Date());
}

function planStartDay(startedAt: string): string {
  const iso = startedAt.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  const parsed = new Date(startedAt);
  if (!Number.isNaN(parsed.getTime())) return dateKey(parsed);
  return todayKey();
}

function shiftDay(startDate: string, offset: number): string {
  const start = new Date(`${startDate}T00:00:00`);
  start.setDate(start.getDate() + offset);
  return dateKey(start);
}

/** Date calendaire du jour N du plan (jour 1 = date de début). */
export function planJourDate(startedAt: string, jour: number): string {
  if (!startedAt || !jour) return todayKey();
  return shiftDay(planStartDay(startedAt), Math.max(0, jour - 1));
}

/** Jour calendaire depuis la date de début (1-indexé, plafonné). */
export function calendarPlanJour(
  plan: ReadingPlan,
  progress: PlanProgress | null,
  today = todayKey(),
): number {
  const total = flattenPlanSteps(plan).length || Math.max(1, plan.totalDays);
  if (!progress?.startedAt) return 1;
  const start = new Date(`${planStartDay(progress.startedAt)}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(Math.max(diff + 1, 1), total);
}

/** Jour à ouvrir : lendemain du dernier jour terminé, ou 1 si rien n’est lu. */
export function latestPlanJour(plan: ReadingPlan, progress: PlanProgress | null): number {
  const total = flattenPlanSteps(plan).length || Math.max(1, plan.totalDays);
  const completed = progress?.completedJours ?? [];
  if (!completed.length) return 1;
  return Math.min(Math.max(...completed) + 1, total);
}

/** Date compacte pour tuiles : « 12 sept. » */
export function formatPlanTileDate(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T00:00:00`));
}
