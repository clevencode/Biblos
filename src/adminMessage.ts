/**
 * Envoi d’un message admin → Notion (catégorie + corps, Status Nouveau).
 * Catégories = pattern feedback in-app (bug / suggestion / réclamation / question).
 */
import { preferredDisplayName, type UserProfile } from "./userProfile";

export type AdminMessageCategoryId =
  | "bug"
  | "suggestion"
  | "complaint"
  | "question"
  | "other";

export type AdminMessageCategory = {
  id: AdminMessageCategoryId;
  /** Libellé UI (FR) — aussi stocké dans Notion Category. */
  label: string;
};

/** 5 types max — évite la paralysie de choix (best practice feedback forms). */
export const ADMIN_MESSAGE_CATEGORIES: readonly AdminMessageCategory[] = [
  { id: "bug", label: "Bug" },
  { id: "suggestion", label: "Suggestion" },
  { id: "complaint", label: "Réclamation" },
  { id: "question", label: "Question" },
  { id: "other", label: "Autre" },
] as const;

export function adminMessageCategoryLabel(
  id: string | null | undefined,
): string | null {
  const hit = ADMIN_MESSAGE_CATEGORIES.find((item) => item.id === id);
  return hit?.label ?? null;
}

export type AdminMessageResult = {
  ok: boolean;
  error?: string;
  url?: string;
  hasToken?: boolean;
};

function newLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function sendAdminMessage(
  profile: UserProfile,
  input: { category: AdminMessageCategoryId; body: string },
): Promise<AdminMessageResult> {
  const categoryId = input.category;
  const categoryLabel = adminMessageCategoryLabel(categoryId);
  const body = String(input.body || "").trim();
  if (!categoryLabel) return { ok: false, error: "Catégorie requise" };
  if (!body) return { ok: false, error: "Message vide" };
  if (body.length > 2000) return { ok: false, error: "Message trop long (2000 max)" };

  try {
    const response = await fetch("/api/admin-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localId: newLocalId(),
        userId: profile.id,
        displayName: preferredDisplayName(profile),
        category: categoryLabel,
        title: categoryLabel,
        body,
        at: new Date().toISOString(),
      }),
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      url?: string;
      hasToken?: boolean;
    };
    if (!data.ok) {
      return {
        ok: false,
        error: data.error || "Envoi échoué",
        hasToken: data.hasToken,
      };
    }
    return { ok: true, url: data.url, hasToken: data.hasToken };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "réseau",
    };
  }
}
