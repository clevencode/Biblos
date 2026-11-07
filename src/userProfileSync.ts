/**
 * Profil utilisateur → Firestore (présence + temps d’usage).
 * Notion n’est plus une destination pour les données app.
 */
import {
  pushUserProfileToCloud,
  type PresenceStatus,
  type ProfileCloudResult,
} from "./firebase/profileCloud";
import { isNotionCmsPullEnabled } from "./contentCms";
import type { UserProfile } from "./userProfile";

export type { PresenceStatus };

type ProfilePushResult = ProfileCloudResult;

let inflight: Promise<ProfilePushResult> | null = null;

export async function syncUserProfileToNotion(
  profile?: UserProfile,
  options?: { presence?: PresenceStatus },
): Promise<ProfilePushResult> {
  const previous = inflight;
  const run = (async () => {
    if (previous) {
      try {
        await previous;
      } catch {
        /* ignore */
      }
    }
    return pushUserProfileToCloud(profile, options);
  })();
  inflight = run.finally(() => {
    if (inflight === run) inflight = null;
  });
  return run;
}

/** @deprecated Alias explicite. */
export const syncUserProfileToCloud = syncUserProfileToNotion;

export function startPresenceAndUsageSync(
  onProfile?: (profile: UserProfile) => void,
  options?: { pauseWhile?: () => boolean },
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const push = (presence: PresenceStatus) => {
    void syncUserProfileToNotion(undefined, { presence }).then((result) => {
      if (result.profile) onProfile?.(result.profile);
    });
  };

  const pushIfAllowed = (presence: PresenceStatus) => {
    if (options?.pauseWhile?.()) return;
    push(presence);
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      pushIfAllowed("Online");
    } else {
      push("Offline");
    }
  };

  const onPageHide = () => {
    push("Offline");
  };

  pushIfAllowed(document.visibilityState === "visible" ? "Online" : "Offline");
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  const heartbeat = window.setInterval(() => {
    if (options?.pauseWhile?.()) return;
    if (document.visibilityState === "visible") pushIfAllowed("Online");
  }, 60_000);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    window.clearInterval(heartbeat);
    push("Offline");
  };
}

/** Indique si le pull CMS Notion est actif (séparé du profil Firebase). */
export function isCloudProfileSyncAvailable(): boolean {
  return isNotionCmsPullEnabled();
}
