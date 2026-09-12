/**
 * Envoi d’un message admin → Notion (Status Nouveau pour automation IA).
 */
import { preferredDisplayName, type UserProfile } from "./userProfile";

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
  input: { title: string; body: string } | string,
): Promise<AdminMessageResult> {
  const title =
    typeof input === "string"
      ? String(input).trim().slice(0, 80)
      : String(input.title || "").trim();
  const body =
    typeof input === "string" ? String(input).trim() : String(input.body || "").trim();
  if (!title) return { ok: false, error: "Titre requis" };
  if (!body) return { ok: false, error: "Message vide" };
  if (title.length > 120) return { ok: false, error: "Titre trop long (120 max)" };
  if (body.length > 2000) return { ok: false, error: "Message trop long (2000 max)" };

  try {
    const response = await fetch("/api/admin-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localId: newLocalId(),
        userId: profile.id,
        displayName: preferredDisplayName(profile),
        title,
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
