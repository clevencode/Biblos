import type { ReadingPlan } from "./types";
import { flattenPlanSteps, resolveResumeStepIndex } from "./planSteps";

const STORAGE_KEY = "biblos-plan-progress-v1";

export type PlanProgress = {
  startedAt: string;
  completedJours: number[];
  lastJour?: number;
};

type ProgressStore = Record<string, PlanProgress>;

function readStore(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return {};
    return data as ProgressStore;
  } catch {
    return {};
  }
}

function writeStore(store: ProgressStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent("biblos-plan-progress"));
  } catch {
    /* quota */
  }
}

export function loadPlanProgress(planId: string): PlanProgress | null {
  if (!planId.trim()) return null;
  return readStore()[planId] ?? null;
}

export function ensurePlanStart(planId: string): PlanProgress {
  const existing = loadPlanProgress(planId);
  if (existing) return existing;
  const created: PlanProgress = {
    startedAt: new Date().toISOString(),
    completedJours: [],
  };
  const store = readStore();
  store[planId] = created;
  writeStore(store);
  return created;
}

export function touchPlanJour(planId: string, jour: number): PlanProgress {
  const base = ensurePlanStart(planId);
  const next = { ...base, lastJour: jour };
  const store = readStore();
  store[planId] = next;
  writeStore(store);
  return next;
}

export function markJourComplete(planId: string, jour: number): PlanProgress {
  const base = ensurePlanStart(planId);
  const set = new Set(base.completedJours);
  set.add(jour);
  const next: PlanProgress = {
    ...base,
    completedJours: [...set].sort((a, b) => a - b),
    lastJour: jour,
  };
  const store = readStore();
  store[planId] = next;
  writeStore(store);
  return next;
}

export function progressCounts(
  plan: ReadingPlan,
  progress: PlanProgress | null,
): { done: number; total: number } {
  const total = flattenPlanSteps(plan).length || Math.max(0, plan.totalDays);
  const done = progress?.completedJours.length ?? 0;
  return { done: Math.min(done, total), total };
}

export function isPlanComplete(plan: ReadingPlan, progress: PlanProgress | null): boolean {
  const { done, total } = progressCounts(plan, progress);
  return total > 0 && done >= total;
}

export function resumeStepIndex(plan: ReadingPlan): number {
  const progress = loadPlanProgress(plan.id);
  const completed = new Set(progress?.completedJours ?? []);
  return resolveResumeStepIndex(plan, completed);
}

export function resetPlanProgress(planId: string): PlanProgress {
  const created: PlanProgress = {
    startedAt: new Date().toISOString(),
    completedJours: [],
  };
  const store = readStore();
  store[planId] = created;
  writeStore(store);
  return created;
}

export function isJourComplete(
  progress: PlanProgress | null,
  jour: number,
): boolean {
  return Boolean(progress?.completedJours.includes(jour));
}
