/**
 * Sync profil local → Notion : nom + temps passé + présence Online/Offline.
 * Admin clevencode : id stable partagé (une ligne Notion pour tous les appareils).
 * Pas de journal d’activité événementiel vers Notion.
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

export type PresenceStatus = "Online" | "Offline";

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
  options?: { presence?: PresenceStatus },
): Promise<ProfilePushResult> {
  if (inflight) return inflight;
  inflight = (async () => {
    let current = ensureStableAdminIdentity(profile ?? loadOrCreateProfile());
    if (!current.onboardedAt) {
      return { ok: false, skipped: true, error: "profil non onboardé", profile: current };
    }
    const timeSpentMinutes = getTimeSpentMinutes();
    const presence: PresenceStatus =
      options?.presence ??
      (typeof document !== "undefined" && document.visibilityState === "visible"
        ? "Online"
        : "Offline");
    const lastSeenAt = new Date().toISOString();
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
          presence,
          lastSeenAt,
          notionUrl: current.notionUrl ?? null,
        }),
        keepalive: presence === "Offline",
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

/**
 * Présence Online/Offline + sync temps. Appelé au démarrage / visibility.
 */
export function startPresenceAndUsageSync(
  onProfile?: (profile: UserProfile) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const push = (presence: PresenceStatus) => {
    void syncUserProfileToNotion(undefined, { presence }).then((result) => {
      if (result.profile) onProfile?.(result.profile);
    });
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      push("Online");
    } else {
      push("Offline");
    }
  };

  const onPageHide = () => {
    push("Offline");
  };

  push(document.visibilityState === "visible" ? "Online" : "Offline");
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  const heartbeat = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      push("Online");
    }
  }, 60_000);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    window.clearInterval(heartbeat);
    push("Offline");
  };
}
