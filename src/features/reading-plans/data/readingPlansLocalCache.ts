/**
 * Mirror local do catálogo `reading_plans` publicados.
 * Firestore = SSOT online; este cache serve o APK/Web offline após a 1.ª hidratação.
 */

import { normalizeReadingPlanDocument } from "../domain/normalizeReadingPlan";
import type { ReadingPlan, ReadingPlanFirestoreDoc } from "../domain/types";

const CACHE_KEY = "biblos-reading-plans-catalog-v1";

export type PublishedPlansCache = {
  updatedAt: string;
  plans: ReadingPlan[];
};

function isPlanShape(value: unknown): value is ReadingPlan {
  if (!value || typeof value !== "object") return false;
  const row = value as ReadingPlan;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    Array.isArray(row.etapes) &&
    row.etapes.length > 0
  );
}

/** Revalida documentos do cache (ignora lixo / versões antigas). */
function sanitizePlans(raw: unknown): ReadingPlan[] {
  if (!Array.isArray(raw)) return [];
  const out: ReadingPlan[] = [];
  for (const item of raw) {
    if (isPlanShape(item) && item.isPublished) {
      const normalized = normalizeReadingPlanDocument(item.id, {
        title: item.title,
        description: item.description,
        isPublished: true,
        totalDays: item.totalDays,
        etapes: item.etapes,
      } satisfies ReadingPlanFirestoreDoc);
      if (normalized?.isPublished) out.push({ ...normalized, isPublished: true });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown } & ReadingPlanFirestoreDoc;
    if (typeof row.id !== "string") continue;
    const normalized = normalizeReadingPlanDocument(row.id, row);
    if (normalized?.isPublished) out.push({ ...normalized, isPublished: true });
  }
  out.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  return out;
}

export function loadPublishedPlansCache(): PublishedPlansCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublishedPlansCache>;
    const plans = sanitizePlans(parsed.plans);
    if (!plans.length) return null;
    return {
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt
          ? parsed.updatedAt
          : new Date(0).toISOString(),
      plans,
    };
  } catch {
    return null;
  }
}

export function savePublishedPlansCache(plans: ReadingPlan[]): void {
  const published = plans.filter((p) => p.isPublished);
  if (!published.length) return;
  try {
    const payload: PublishedPlansCache = {
      updatedAt: new Date().toISOString(),
      plans: published,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
