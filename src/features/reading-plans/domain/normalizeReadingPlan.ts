import type {
  ReadingPlan,
  ReadingPlanEtape,
  ReadingPlanFirestoreDoc,
  ReadingPlanJour,
} from "./types";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function parseJours(raw: unknown): ReadingPlanJour[] {
  if (!Array.isArray(raw)) return [];
  const out: ReadingPlanJour[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const numero = asInt(row.numero);
    const passage = asString(row.passage);
    if (numero < 1 || !passage) continue;
    out.push({ numero, passage });
  }
  return out.sort((a, b) => a.numero - b.numero);
}

function parseEtapes(raw: unknown): ReadingPlanEtape[] {
  if (!Array.isArray(raw)) return [];
  const out: ReadingPlanEtape[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const order = asInt(row.order);
    const name = asString(row.name);
    const jours = parseJours(row.jours);
    if (!name || !jours.length) continue;
    out.push({ order: order || out.length + 1, name, jours });
  }
  return out.sort((a, b) => a.order - b.order);
}

function deriveTotalDays(etapes: ReadingPlanEtape[], fallback: number): number {
  if (fallback > 0) return fallback;
  const nums = etapes.flatMap((e) => e.jours.map((j) => j.numero));
  return nums.length ? Math.max(...nums) : 0;
}

/** Valida e normaliza um documento `reading_plans/{id}`. */
export function normalizeReadingPlan(
  id: string,
  data: ReadingPlanFirestoreDoc,
): ReadingPlan | null {
  if (!id.trim()) return null;
  const isPublished = asBool(data.isPublished);
  const title = asString(data.title);
  const description = asString(data.description);
  const etapes = parseEtapes(data.etapes);
  if (!isPublished || !title || !etapes.length) return null;

  const totalDays = deriveTotalDays(etapes, asInt(data.totalDays));

  return {
    id,
    title,
    description,
    isPublished: true,
    totalDays,
    etapes,
  };
}
