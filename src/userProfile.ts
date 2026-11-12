/** Profil utilisateur local — identité stable (Firebase uid) + noms d’affichage. */

import type { ConsumerAuthUser } from "./features/consumer-auth/data/consumerFirebaseAuth";

const PROFILE_KEY = "biblos-user-profile";

export type UserProfile = {
  /** Identifiant stable (souvent = firebaseUid). */
  id: string;
  firstName: string;
  lastName: string;
  /** Conservé pour sync ; affichage = nom complet. */
  preferredName: string;
  createdAt: string;
  onboardedAt: string | null;
  /** UID Firebase Auth (compte connecté). */
  firebaseUid?: string | null;
  email?: string | null;
  photoURL?: string | null;
  /** Ancien uuid local avant liaison Firebase. */
  legacyLocalId?: string | null;
};

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanName(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 64);
}

/** Affichage / saisie « Nom complet » à partir de prénom + nom stockés. */
export function joinFullName(firstName: string, lastName: string): string {
  return [cleanName(firstName), cleanName(lastName)].filter(Boolean).join(" ");
}

/** Découpe « Nom complet » pour stocker firstName / lastName. */
export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const cleaned = String(fullName ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 128);
  if (!cleaned) return { firstName: "", lastName: "" };
  const space = cleaned.indexOf(" ");
  if (space < 0) return { firstName: cleanName(cleaned), lastName: "" };
  return {
    firstName: cleanName(cleaned.slice(0, space)),
    lastName: cleanName(cleaned.slice(space + 1)),
  };
}

export function preferredDisplayName(profile: UserProfile): string {
  const joined = joinFullName(profile.firstName, profile.lastName);
  if (joined) return joined;
  return cleanName(profile.preferredName);
}

/** Propriétaire CMS — fallback si `VITE_CLEVENCODE_ADMIN_EMAIL` absente. */
export const CLEVENCODE_ADMIN_EMAIL_DEFAULT = "clevypetit@gmail.com";

/** E-mail propriétaire (env ou défaut) — insensible à la casse. */
export function getClevencodeAdminEmail(): string {
  const fromEnv = String(import.meta.env.VITE_CLEVENCODE_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  return fromEnv || CLEVENCODE_ADMIN_EMAIL_DEFAULT;
}

export function isClevencodeAdminEmail(
  email: string | null | undefined,
): boolean {
  const needle = getClevencodeAdminEmail();
  return (
    String(email ?? "")
      .trim()
      .toLowerCase() === needle
  );
}

/** Compte connecté via Firebase. */
export function isFirebaseSignedIn(profile: UserProfile): boolean {
  return Boolean(profile.firebaseUid?.trim());
}

export function isProfileOnboarded(profile: UserProfile): boolean {
  if (!isFirebaseSignedIn(profile)) return false;
  if (!profile.onboardedAt) return false;
  return Boolean(cleanName(profile.firstName));
}

function emptyProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: newId(),
    firstName: "",
    lastName: "",
    preferredName: "",
    createdAt: now,
    onboardedAt: null,
  };
}

function parseProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const id =
    typeof data.id === "string" && data.id.trim() ? data.id.trim() : null;
  if (!id) return null;
  return {
    id,
    firstName: cleanName(String(data.firstName ?? "")),
    lastName: cleanName(String(data.lastName ?? "")),
    preferredName: cleanName(String(data.preferredName ?? "")),
    createdAt:
      typeof data.createdAt === "string" && data.createdAt
        ? data.createdAt
        : new Date().toISOString(),
    onboardedAt:
      typeof data.onboardedAt === "string" && data.onboardedAt
        ? data.onboardedAt
        : null,
    firebaseUid:
      typeof data.firebaseUid === "string" && data.firebaseUid.trim()
        ? data.firebaseUid.trim()
        : null,
    email:
      typeof data.email === "string" && data.email.trim()
        ? data.email.trim()
        : null,
    photoURL:
      typeof data.photoURL === "string" && data.photoURL.trim()
        ? data.photoURL.trim()
        : null,
    legacyLocalId:
      typeof data.legacyLocalId === "string" && data.legacyLocalId.trim()
        ? data.legacyLocalId.trim()
        : null,
  };
}

function writeProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* quota / private mode */
  }
}

function namesFromAuthUser(user: ConsumerAuthUser): {
  firstName: string;
  lastName: string;
} {
  const display = cleanName(user.displayName || "");
  if (!display) return { firstName: "", lastName: "" };
  return splitFullName(display);
}

/**
 * Fusionne le compte Firebase avec le profil local (conserve legacyLocalId).
 */
export function applyFirebaseAuthUser(user: ConsumerAuthUser): UserProfile {
  const current = loadOrCreateProfile();
  const legacy =
    current.legacyLocalId ||
    (current.firebaseUid && current.firebaseUid !== user.uid
      ? null
      : current.id !== user.uid
        ? current.id
        : null);
  const authNames = namesFromAuthUser(user);
  const email = user.email?.trim() || current.email || null;
  const next: UserProfile = {
    ...current,
    firebaseUid: user.uid,
    email,
    photoURL: user.photoURL?.trim() || current.photoURL || null,
    legacyLocalId: legacy,
    firstName: current.firstName || authNames.firstName,
    lastName: current.lastName || authNames.lastName,
    preferredName:
      current.preferredName ||
      joinFullName(
        current.firstName || authNames.firstName,
        current.lastName || authNames.lastName,
      ),
    id: user.uid,
  };
  writeProfile(next);
  return next;
}

/** Efface les champs Firebase tout en conservant un nouveau profil local. */
export function clearFirebaseFromProfile(): UserProfile {
  const current = loadOrCreateProfile();
  const next: UserProfile = {
    ...current,
    firebaseUid: null,
    email: null,
    photoURL: null,
    onboardedAt: null,
    id: current.legacyLocalId?.trim() || newId(),
    legacyLocalId: null,
  };
  writeProfile(next);
  return next;
}

export function loadOrCreateProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = parseProfile(JSON.parse(raw) as unknown);
      if (parsed) return parsed;
    }
  } catch {
    /* ignore */
  }
  const created = emptyProfile();
  writeProfile(created);
  return created;
}

export type UserProfilePatch = Partial<
  Pick<UserProfile, "firstName" | "lastName" | "preferredName" | "onboardedAt">
>;

export function saveUserProfile(patch: UserProfilePatch): UserProfile {
  const current = loadOrCreateProfile();
  const firstName =
    patch.firstName !== undefined
      ? cleanName(patch.firstName)
      : current.firstName;
  const lastName =
    patch.lastName !== undefined ? cleanName(patch.lastName) : current.lastName;
  const next: UserProfile = {
    ...current,
    firstName,
    lastName,
    preferredName: joinFullName(firstName, lastName),
    onboardedAt:
      patch.onboardedAt !== undefined ? patch.onboardedAt : current.onboardedAt,
  };
  writeProfile(next);
  return next;
}

export function completeOnboarding(input: {
  firstName: string;
  lastName: string;
  preferredName?: string;
}): UserProfile {
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  return saveUserProfile({
    firstName,
    lastName,
    preferredName: joinFullName(firstName, lastName),
    onboardedAt: new Date().toISOString(),
  });
}

function clearStorageMatching(
  storage: Storage,
  keepKey?: (key: string) => boolean,
): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }
  for (const key of keys) {
    if (keepKey?.(key)) continue;
    const lower = key.toLowerCase();
    if (
      lower.startsWith("biblos") ||
      lower.startsWith("studyos") ||
      lower.includes("biblos") ||
      lower.includes("flashcard")
    ) {
      storage.removeItem(key);
    }
  }
}

/**
 * Efface profil + données locales de l’app sur cet appareil.
 * La Bible hors ligne IndexedDB est aussi vidée.
 */
export async function wipeLocalUserData(): Promise<void> {
  try {
    clearStorageMatching(localStorage);
  } catch {
    /* private mode */
  }
  try {
    clearStorageMatching(sessionStorage);
  } catch {
    /* ignore */
  }
  try {
    const { clearOfflineBible } = await import("./bibleOffline");
    await clearOfflineBible();
  } catch {
    /* IDB indisponible */
  }
}
