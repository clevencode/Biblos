/**
 * Profil + présence + temps d’usage → Firestore (pas Notion).
 */
import { doc, setDoc } from "firebase/firestore";
import { getFirebaseAuth } from "./app";
import { firestoreUserRoot, getFirestoreDbReady } from "./firestore";
import {
  CLEVENCODE_ADMIN_USER_ID,
  ensureStableAdminIdentity,
  isClevencodeAdmin,
  isFirebaseSignedIn,
  loadOrCreateProfile,
  type UserProfile,
} from "../userProfile";

export type PresenceStatus = "Online" | "Offline";

export type ProfileCloudResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  profile?: UserProfile;
};

function resolveFirestoreUid(profile: UserProfile): string | null {
  const uid = profile.firebaseUid?.trim();
  if (uid) return uid;
  if (!isFirebaseSignedIn(profile)) return null;
  return null;
}

export async function pushUserProfileToCloud(
  profile?: UserProfile,
  options?: { presence?: PresenceStatus },
): Promise<ProfileCloudResult> {
  let current = ensureStableAdminIdentity(
    profile?.onboardedAt ? profile : loadOrCreateProfile(),
  );
  const firestoreUid = resolveFirestoreUid(current);
  if (!firestoreUid) {
    return { ok: false, skipped: true, error: "non connecté", profile: current };
  }
  if (!current.onboardedAt) {
    return { ok: false, skipped: true, error: "profil non onboardé", profile: current };
  }

  const authUser = getFirebaseAuth()?.currentUser;
  if (authUser && authUser.uid !== firestoreUid) {
    return { ok: false, skipped: true, error: "session invalide", profile: current };
  }

  const db = await getFirestoreDbReady();
  if (!db) {
    return { ok: false, skipped: true, error: "Firestore indisponible", profile: current };
  }

  const presence: PresenceStatus =
    options?.presence ??
    (typeof document !== "undefined" && document.visibilityState === "visible"
      ? "Online"
      : "Offline");
  const lastSeenAt = new Date().toISOString();

  const { getTimeSpentMinutes } = await import("../appUsage");
  const timeSpentMinutes = getTimeSpentMinutes();

  const notionStyleId = isClevencodeAdmin(current)
    ? CLEVENCODE_ADMIN_USER_ID
    : current.id;

  try {
    await setDoc(
      doc(db, firestoreUserRoot(firestoreUid)),
      {
        firstName: current.firstName,
        lastName: current.lastName,
        preferredName: current.preferredName,
        createdAt: current.createdAt,
        onboardedAt: current.onboardedAt,
        email: current.email ?? authUser?.email ?? null,
        photoURL: current.photoURL ?? authUser?.photoURL ?? null,
        legacyLocalId: current.legacyLocalId ?? null,
        appUserId: notionStyleId,
        timeSpentMinutes,
        presence,
        lastSeenAt,
        updatedAt: lastSeenAt,
      },
      { merge: true },
    );
    const { markTimeSpentSynced } = await import("../appUsage");
    markTimeSpentSynced(timeSpentMinutes);
    return { ok: true, profile: current };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Firestore",
      profile: current,
    };
  }
}
