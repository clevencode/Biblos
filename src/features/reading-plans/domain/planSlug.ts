/**
 * Domain — slug Firestore `reading_plans/{id}` (antierro, sem input manual).
 */
export function slugifyPlanId(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
