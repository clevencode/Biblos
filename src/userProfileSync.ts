/**
 * Sync profil local → Notion (nome + tempo gasto — pas de notes personnelles).
 * Admin clevencode : id stable partagé (une ligne Notion pour tous les appareils).
 */
import { apiUrl } from "./apiBase";
import {
  getTimeSpentMinutes,
  markTimeSpentSynced,
} from "./appUsage";
import {
  CLEVENCODE_ADMIN_USER_ID,
  ensureStableAdminIdentity,
  isClevencodeAdmin,
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
  profile?: UserProfile;
};

let inflight: Promise<ProfilePushResult> | null = null;

function adoptStableLocalId(
  current: UserProfile,
  remoteLocalId: string | undefined,
): UserProfile {
  const nextId = String(remoteLocalId || "").trim();
  if (!nextId || nextId === current.id) {
    return ensureStableAdminIdentity(current);
  }
  if (!(isClevencodeAdmin(current) || nextId === CLEVENCODE_ADMIN_USER_ID)) {
    return current;
  }
  const next: UserProfile = { ...current, id: nextId };
  try {
    localStorage.setItem("biblos-user-profile", JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export async function syncUserProfileToNotion(
  profile?: UserProfile,
): Promise<ProfilePushResult> {
  if (inflight) return inflight;
  inflight = (async () => {
    let current = ensureStableAdminIdentity(profile ?? loadOrCreateProfile());
    if (!current.onboardedAt) {
      return { ok: false, skipped: true, error: "profil non onboardé", profile: current };
    }
    const timeSpentMinutes = getTimeSpentMinutes();
    try {
      const response = await fetch(apiUrl("/api/user-profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId: isClevencodeAdmin(current)
            ? CLEVENCODE_ADMIN_USER_ID
            : current.id,
          firstName: current.firstName,
          lastName: current.lastName,
          preferredName: current.preferredName,
          createdAt: current.createdAt,
          onboardedAt: current.onboardedAt,
          timeSpentMinutes,
          notionUrl: current.notionUrl ?? null,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
        hasToken?: boolean;
        localId?: string;
      };
      if (!data.ok) {
        return {
          ok: false,
          error: data.error || "sync profil échoué",
          hasToken: data.hasToken,
          profile: current,
        };
      }
      markTimeSpentSynced(timeSpentMinutes);
      current = adoptStableLocalId(current, data.localId);
      if (data.url && data.url !== current.notionUrl) {
        current = saveUserProfile({ notionUrl: data.url });
      }
      return { ok: true, url: data.url, hasToken: data.hasToken, profile: current };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "réseau",
        profile: current,
      };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
