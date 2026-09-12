/** Profil utilisateur local — identité stable (UUID) + noms d’affichage. */

const PROFILE_KEY = "biblos-user-profile";

export type UserProfile = {
  /** Identifiant stable (ne change pas si le nom change). */
  id: string;
  firstName: string;
  lastName: string;
  /** Conservé pour sync ; affichage = nom complet. */
  preferredName: string;
  createdAt: string;
  onboardedAt: string | null;
  /** URL Notion après sync cloud (optionnel). */
  notionUrl?: string | null;
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
  const full = joinFullName(profile.firstName, profile.lastName);
  return full || "Lecteur";
}

export function isProfileOnboarded(profile: UserProfile): boolean {
  return Boolean(profile.onboardedAt && cleanName(profile.firstName));
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
  };
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
  return next;
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

