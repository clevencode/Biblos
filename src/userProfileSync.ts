/**
 * Sync profil local → Notion (local-first + outbox).
 */
import {
  loadOrCreateProfile,
  saveUserProfile,
  type UserProfile,
} from "./userProfile";

type ProfilePushResult = {
  ok: boolean;
  skipped?: boolean;
  url?: string;
  error?: string;
  hasToken?: boolean;
};

let inflight: Promise<ProfilePushResult> | null = null;

export async function syncUserProfileToNotion(
  profile?: UserProfile,
): Promise<ProfilePushResult> {
  if (inflight) return inflight;
  inflight = (async () => {
    const current = profile ?? loadOrCreateProfile();
    if (!current.onboardedAt) {
      return { ok: false, skipped: true, error: "profil non onboardé" };
    }
    try {
      const response = await fetch("/api/user-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId: current.id,
          firstName: current.firstName,
          lastName: current.lastName,
          preferredName: current.preferredName,
          createdAt: current.createdAt,
          onboardedAt: current.onboardedAt,
          notionUrl: current.notionUrl ?? null,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
        hasToken?: boolean;
      };
      if (!data.ok) {
        return {
          ok: false,
          error: data.error || "sync profil échoué",
          hasToken: data.hasToken,
        };
      }
      if (data.url && data.url !== current.notionUrl) {
        saveUserProfile({ notionUrl: data.url });
      }
      return { ok: true, url: data.url, hasToken: data.hasToken };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "réseau",
      };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
