import { todayKey } from "./calendar";
import { clearDayNotesForPlan } from "./planDayNote";
import type { ReadingPlan } from "./types";

const KEY = "biblos-plan-progress";

export type PlanProgress = {
  startDate: string;
  completedDays: number[];
};

type Store = Record<string, PlanProgress>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

export function loadPlanProgress(planId: string): PlanProgress | null {
  return readStore()[planId] ?? null;
}

export function ensurePlanStart(planId: string): PlanProgress {
  const store = readStore();
  if (store[planId]?.startDate) return store[planId];
  const next = { startDate: todayKey(), completedDays: [] as number[] };
  store[planId] = next;
  writeStore(store);
  return next;
}

export function markDayRead(planId: string, jour: number): PlanProgress {
  const store = readStore();
  const current = store[planId] ?? { startDate: todayKey(), completedDays: [] };
  const completedDays = current.completedDays.includes(jour)
    ? current.completedDays.filter((day) => day !== jour)
    : [...current.completedDays, jour].sort((a, b) => a - b);
  const next = { ...current, completedDays };
  store[planId] = next;
  writeStore(store);
  return next;
}

/** Marque le jour comme lu (sans bascule). */
export function ensureDayCompleted(planId: string, jour: number): PlanProgress {
  const store = readStore();
  const current = store[planId] ?? { startDate: todayKey(), completedDays: [] };
  if (current.completedDays.includes(jour)) return current;
  const next = {
    ...current,
    completedDays: [...current.completedDays, jour].sort((a, b) => a - b),
  };
  store[planId] = next;
  writeStore(store);
  return next;
}

/** Remet le plan à zéro (nouvelle lecture). */
export function resetPlanProgress(planId: string): PlanProgress {
  const store = readStore();
  const next = { startDate: todayKey(), completedDays: [] as number[] };
  store[planId] = next;
  writeStore(store);
  return next;
}

/** Apaga progresso + notes quotidiennes locais de um plano removido do Notion. */
export function clearPlanLocalState(planId: string): void {
  if (!planId) return;
  const store = readStore();
  if (planId in store) {
    delete store[planId];
    writeStore(store);
  }
  try {
    localStorage.removeItem(`biblos-devotional-done:${planId}`);
    localStorage.removeItem(`biblos-plan-intro-seen:${planId}`);
  } catch {
    /* private mode */
  }
  clearDayNotesForPlan(planId);
}

/** True si tous les jours du plan sont marqués lus. */
export function isPlanComplete(
  plan: { days: { jour: number }[] } | null | undefined,
  progress: PlanProgress | null | undefined,
): boolean {
  const days = plan?.days ?? [];
  if (!days.length) return false;
  const done = new Set(progress?.completedDays ?? []);
  return days.every((day) => done.has(day.jour));
}

export function progressCounts(
  plan: { days: unknown[] } | null | undefined,
  progress: PlanProgress | null | undefined,
): { done: number; total: number } {
  const total = plan?.days?.length ?? 0;
  const done = progress?.completedDays?.length ?? 0;
  return { done, total };
}

/** Jour calendaire depuis la date de début (1-indexé). */
export function calendarJour(startDate: string, totalDays: number, today = todayKey()): number {
  if (!startDate || !totalDays) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(Math.max(diff + 1, 1), totalDays);
}

/** Premier jour non lu, ou le jour calendaire courant. */
export function nextUnreadJour(plan: ReadingPlan, progress: PlanProgress | null): number {
  const p = progress ?? { startDate: todayKey(), completedDays: [] };
  const cal = calendarJour(p.startDate, plan.days.length || 1);
  const unread = plan.days.find((day) => !p.completedDays.includes(day.jour));
  if (unread && unread.jour <= cal) return unread.jour;
  return cal;
}
