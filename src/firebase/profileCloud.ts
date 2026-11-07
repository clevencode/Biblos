/**
 * Profil + présence + temps d’usage → Firestore (pas Notion).
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseAuth } from "./app";
import { firestoreUserRoot, getFirestoreDbReady } from "./firestore";
import {
  CLEVENCODE_ADMIN_USER_ID,
  ensureStableAdminIdentity,
  isClevencodeAdmin,
  isFirebaseSignedIn,
  loadOrCreateProfile,
  saveUserProfile,
  type UserProfile,
} from "../userProfile";

const PROFILE_PULL_META_KEY = "biblos-profile-pull-meta";

type ProfilePullMeta = {
  remoteUpdatedAt: string | null;
};

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

function readProfilePullMeta(): ProfilePullMeta {
  try {
    const raw = localStorage.getItem(PROFILE_PULL_META_KEY);
    if (!raw) return { remoteUpdatedAt: null };
    const parsed = JSON.parse(raw) as ProfilePullMeta;
    return { remoteUpdatedAt: parsed.remoteUpdatedAt ?? null };
  } catch {
    return { remoteUpdatedAt: null };
  }
}

function writeProfilePullMeta(remoteUpdatedAt: string) {
  try {
    localStorage.setItem(
      PROFILE_PULL_META_KEY,
      JSON.stringify({ remoteUpdatedAt } satisfies ProfilePullMeta),
    );
  } catch {
    /* private mode */
  }
}

/** Applique nom / e-mail distants si plus récents (multi-appareil). */
export async function pullUserProfileFromCloud(): Promise<{
  ok: boolean;
  applied: boolean;
  profile?: UserProfile;
  error?: string;
}> {
  const current = loadOrCreateProfile();
  const firestoreUid = resolveFirestoreUid(current);
  if (!firestoreUid || !current.onboardedAt) {
    return { ok: true, applied: false, profile: current };
  }
  const db = await getFirestoreDbReady();
  if (!db) return { ok: false, applied: false, error: "Firestore indisponible" };

  try {
    const snap = await getDoc(doc(db, firestoreUserRoot(firestoreUid)));
    if (!snap.exists()) return { ok: true, applied: false, profile: current };

    const data = snap.data() as Record<string, unknown>;
    const remoteUpdated =
      typeof data.updatedAt === "string" ? data.updatedAt : null;
    if (!remoteUpdated) return { ok: true, applied: false, profile: current };

    const meta = readProfilePullMeta();
    if (meta.remoteUpdatedAt === remoteUpdated) {
      return { ok: true, applied: false, profile: current };
    }

    const remoteFirst = String(data.firstName ?? "").trim();
    const remoteLast = String(data.lastName ?? "").trim();
    const remotePreferred = String(data.preferredName ?? "").trim();
    if (!remoteFirst && !remotePreferred) {
      writeProfilePullMeta(remoteUpdated);
      return { ok: true, applied: false, profile: current };
    }

    const next = saveUserProfile({
      firstName: remoteFirst || current.firstName,
      lastName: remoteLast || current.lastName,
      preferredName: remotePreferred || current.preferredName,
    });
    writeProfilePullMeta(remoteUpdated);
    return { ok: true, applied: true, profile: next };
  } catch (error) {
    return {
      ok: false,
      applied: false,
      error: error instanceof Error ? error.message : "pull profil",
    };
  }
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
