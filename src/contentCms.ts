/**
 * Notion = CMS lecture seule (mobile-first).
 * Plans de lecture + notifications (+ catalogue éditorial via /api/catalog).
 * Aucune donnée utilisateur n’est envoyée vers Notion.
 * Activité / profil / aide → Firebase (Firestore).
 */

/** Pull plans + notifications depuis les APIs Vercel (Notion côté serveur). */
export const NOTION_CMS_PULL_ENABLED = true;

/** Écritures app → Notion désactivées définitivement. */
export const NOTION_APP_WRITES_ENABLED = false;

export function isNotionCmsPullEnabled(): boolean {
  if (!NOTION_CMS_PULL_ENABLED) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return true;
}

export function isNotionAppWriteEnabled(): boolean {
  return NOTION_APP_WRITES_ENABLED;
}

/** @deprecated Utiliser isNotionCmsPullEnabled — conservé pour imports existants. */
export function isNotionClientSyncEnabled(): boolean {
  return isNotionCmsPullEnabled();
}
