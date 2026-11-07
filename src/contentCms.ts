/**
 * Notion = CMS lecture seule (mobile-first).
 * Plans de lecture + notifications (+ catalogue éditorial via /api/catalog).
 * Aucune donnée utilisateur n’est envoyée vers Notion.
 * Activité / profil / aide → Firebase (Firestore).
 */

/** Pull plans + notifications depuis les APIs Vercel (Notion côté serveur). */
export const NOTION_CMS_PULL_ENABLED = true;

export function isNotionCmsPullEnabled(): boolean {
  if (!NOTION_CMS_PULL_ENABLED) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return true;
}
