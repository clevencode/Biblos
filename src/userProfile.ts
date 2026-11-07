/** Profil utilisateur local — identité stable (Firebase uid) + noms d’affichage. */

import { CLEVENCODE_ADMIN_EMAIL } from "./firebase/config";
import type { FirebaseAuthUser } from "./firebase/auth";

const PROFILE_KEY = "biblos-user-profile";

export type UserProfile = {
  /** Identifiant stable sync Notion (souvent = firebaseUid ou id admin). */
  id: string;
  firstName: string;
  lastName: string;
  /** Conservé pour sync ; affichage = nom complet. */
  preferredName: string;
  createdAt: string;
  onboardedAt: string | null;
  /** URL Notion après sync cloud (optionnel). */
  notionUrl?: string | null;
  /** UID Firebase Auth (obligatoire pour un compte actif). */
  firebaseUid?: string | null;
  email?: string | null;
  photoURL?: string | null;
  /** Ancien uuid local avant liaison Google (optionnel). */
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

/** Nom d’affichage de secours (UI) — ne compte pas comme compte réel. */
export const DEFAULT_VISITOR_NAME = "Invité";

export function preferredDisplayName(profile: UserProfile): string {
  const full = joinFullName(profile.firstName, profile.lastName);
  return full || DEFAULT_VISITOR_NAME;
}

/** Nom d’admin reconnu (insensible à la casse / accents). */
export const CLEVENCODE_ADMIN_NAME = "clevencode";

/**
 * Identifiant stable partagé sur tous les appareils pour l’admin.
 * Évite une nouvelle ligne Notion à chaque login sur un autre device.
 */
export const CLEVENCODE_ADMIN_USER_ID = "biblos-admin-clevencode";

function normalizeIdentityName(value: string): string {
  return cleanName(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function isClevencodeAdminName(
  firstName: string,
  lastName = "",
  preferredName = "",
): boolean {
  const needle = normalizeIdentityName(CLEVENCODE_ADMIN_NAME);
  const candidates = [
    preferredName,
    firstName,
    joinFullName(firstName, lastName),
  ];
  return candidates.some((value) => normalizeIdentityName(value) === needle);
}

/** Detecte le propriétaire de l’app via le nom complet / prénom. */
export function isClevencodeAdminEmail(email: string | null | undefined): boolean {
  const needle = CLEVENCODE_ADMIN_EMAIL.trim().toLowerCase();
  if (!needle) return false;
  return String(email ?? "")
    .trim()
    .toLowerCase() === needle;
}

export function isClevencodeAdmin(profile?: UserProfile | null): boolean {
  const p = profile ?? loadOrCreateProfile();
  if (isClevencodeAdminEmail(p.email)) return true;
  return isClevencodeAdminName(p.firstName, p.lastName, p.preferredName);
}

/** Compte connecté via Firebase Google. */
export function isFirebaseSignedIn(profile: UserProfile): boolean {
  return Boolean(profile.firebaseUid?.trim());
}

/**
 * Force l’id local de l’admin vers l’id stable (tous appareils → une ligne Notion).
 */
export function ensureStableAdminIdentity(profile: UserProfile): UserProfile {
  if (!isClevencodeAdmin(profile)) return profile;
  if (profile.id === CLEVENCODE_ADMIN_USER_ID) return profile;
  const next: UserProfile = { ...profile, id: CLEVENCODE_ADMIN_USER_ID };
  writeProfile(next);
  return next;
}

export function isProfileOnboarded(profile: UserProfile): boolean {
  if (!isFirebaseSignedIn(profile)) return false;
  if (!profile.onboardedAt) return false;
  const name = cleanName(profile.firstName);
  if (!name) return false;
  // Placeholders auto (Invité / Visitante) ≠ compte nommé
  const folded = normalizeIdentityName(name);
  if (folded === normalizeIdentityName(DEFAULT_VISITOR_NAME) || folded === "visitante") {
    return false;
  }
  return true;
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

/**
 * Ancien flux « Visitante/Invité auto » → id conservé, onboarding effacé
 * pour exiger le nom au premier marquage.
 */
function migrateAutoVisitor(profile: UserProfile): UserProfile {
  const folded = normalizeIdentityName(profile.firstName);
  const isPlaceholder =
    !folded ||
    folded === normalizeIdentityName(DEFAULT_VISITOR_NAME) ||
    folded === "visitante";
  if (!isPlaceholder) return profile;
  if (!profile.onboardedAt && !cleanName(profile.firstName)) return profile;

  const next: UserProfile = {
    ...profile,
    firstName: "",
    lastName: "",
    preferredName: "",
    onboardedAt: null,
  };
  writeProfile(next);
  return next;
}

function parseProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : null;
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
    notionUrl:
      typeof data.notionUrl === "string" && data.notionUrl.trim()
        ? data.notionUrl.trim()
        : null,
    firebaseUid:
      typeof data.firebaseUid === "string" && data.firebaseUid.trim()
        ? data.firebaseUid.trim()
        : null,
    email:
      typeof data.email === "string" && data.email.trim() ? data.email.trim() : null,
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

function namesFromGoogleUser(user: FirebaseAuthUser): {
  firstName: string;
  lastName: string;
} {
  const display = cleanName(user.displayName || "");
  if (!display) return { firstName: "", lastName: "" };
  return splitFullName(display);
}

function resolveProfileIdAfterFirebase(
  profile: UserProfile,
  uid: string,
  email: string | null,
): string {
  if (isClevencodeAdminEmail(email) || isClevencodeAdmin(profile)) {
    return CLEVENCODE_ADMIN_USER_ID;
  }
  return uid;
}

/**
 * Fusionne le compte Google avec le profil local (conserve legacyLocalId).
 */
export function applyFirebaseAuthUser(user: FirebaseAuthUser): UserProfile {
  const current = loadOrCreateProfile();
  const legacy =
    current.legacyLocalId ||
    (current.firebaseUid && current.firebaseUid !== user.uid ? null : current.id) ||
    (current.id && current.id !== user.uid && current.id !== CLEVENCODE_ADMIN_USER_ID
      ? current.id
      : null);
  const googleNames = namesFromGoogleUser(user);
  const email = user.email?.trim() || current.email || null;
  const next: UserProfile = {
    ...current,
    firebaseUid: user.uid,
    email,
    photoURL: user.photoURL?.trim() || current.photoURL || null,
    legacyLocalId: legacy,
    firstName: current.firstName || googleNames.firstName,
    lastName: current.lastName || googleNames.lastName,
    preferredName:
      current.preferredName ||
      joinFullName(
        current.firstName || googleNames.firstName,
        current.lastName || googleNames.lastName,
      ),
  };
  next.id = resolveProfileIdAfterFirebase(next, user.uid, email);
  writeProfile(next);
  return ensureStableAdminIdentity(next);
}

/** Efface les champs Firebase tout en conservant le profil local. */
export function clearFirebaseFromProfile(): UserProfile {
  const current = loadOrCreateProfile();
  const next: UserProfile = {
    ...current,
    firebaseUid: null,
    email: null,
    photoURL: null,
    onboardedAt: null,
    id: newId(),
  };
  writeProfile(next);
  return next;
}

export function loadOrCreateProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = parseProfile(JSON.parse(raw) as unknown);
      if (parsed) {
        return ensureStableAdminIdentity(migrateAutoVisitor(parsed));
      }
    }
  } catch {
    /* ignore */
  }
  const created = emptyProfile();
  writeProfile(created);
  return created;
}

function writeProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* quota / private mode */
  }
}

export type UserProfilePatch = Partial<
  Pick<UserProfile, "firstName" | "lastName" | "preferredName" | "onboardedAt" | "notionUrl">
>;

export function saveUserProfile(patch: UserProfilePatch): UserProfile {
  const current = loadOrCreateProfile();
  const firstName =
    patch.firstName !== undefined ? cleanName(patch.firstName) : current.firstName;
  const lastName =
    patch.lastName !== undefined ? cleanName(patch.lastName) : current.lastName;
  const next: UserProfile = {
    ...current,
    firstName,
    lastName,
    preferredName: joinFullName(firstName, lastName),
    onboardedAt:
      patch.onboardedAt !== undefined ? patch.onboardedAt : current.onboardedAt,
    notionUrl:
      patch.notionUrl !== undefined ? patch.notionUrl : current.notionUrl ?? null,
  };
  writeProfile(next);
  return ensureStableAdminIdentity(next);
}

export function completeOnboarding(input: {
  firstName: string;
  lastName: string;
  preferredName?: string;
}): UserProfile {
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  const preferredName = joinFullName(firstName, lastName);
  return saveUserProfile({
    firstName,
    lastName,
    preferredName,
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

