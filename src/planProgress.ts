import { todayKey } from "./calendar";
import type { PlanDay, ReadingPlan } from "./types";

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

export function getPlanProgress(planId: string): PlanProgress {
  const existing = readStore()[planId];
  if (existing?.startDate) return existing;
  return { startDate: todayKey(), completedDays: [] };
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

export const ensurePlanStarted = ensurePlanStart;

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

/** Alias : marque / démarque le jour comme lu. */
export const toggleDayRead = markDayRead;

export const markPlanDayRead = markDayRead;

export function isPlanDayRead(planId: string, jour: number): boolean {
  return getPlanProgress(planId).completedDays.includes(jour);
}

export function progressCounts(
  plan: { days: unknown[] } | null | undefined,
  progress: PlanProgress | null | undefined,
): { done: number; total: number } {
  const total = plan?.days?.length ?? 0;
  const done = progress?.completedDays?.length ?? 0;
  return { done, total };
}

export function dayEntry(plan: ReadingPlan, jour: number): PlanDay | null {
  return plan.days.find((day) => day.jour === jour) ?? null;
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

/** Date ISO du jour N du plan (1-indexé) depuis startDate. */
export function dateForPlanJour(startDate: string, jour: number): string {
  return addDaysKey(startDate, Math.max(0, jour - 1));
}

/** Jour du plan pour une date calendaire, ou null hors plage. */
export function planJourForDate(
  startDate: string,
  day: string,
  totalDays: number,
): number | null {
  if (!startDate || !day || !totalDays) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const selected = new Date(`${day}T00:00:00`);
  const diff = Math.floor((selected.getTime() - start.getTime()) / 86_400_000);
  const jour = diff + 1;
  if (jour < 1 || jour > totalDays) return null;
  return jour;
}

function addDaysKey(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
