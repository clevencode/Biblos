/** Profil utilisateur local — identité stable (UUID) + noms d’affichage. */

const PROFILE_KEY = "biblos-user-profile";

export type UserProfile = {
  /** Identifiant stable (ne change pas si le nom change). */
  id: string;
  firstName: string;
  lastName: string;
  /** Nom préféré d’affichage ; sinon prénom + nom. */
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

export function preferredDisplayName(profile: UserProfile): string {
  const preferred = cleanName(profile.preferredName);
  if (preferred) return preferred;
  const full = [cleanName(profile.firstName), cleanName(profile.lastName)]
    .filter(Boolean)
    .join(" ");
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
  const next: UserProfile = {
    ...current,
    firstName:
      patch.firstName !== undefined ? cleanName(patch.firstName) : current.firstName,
    lastName:
      patch.lastName !== undefined ? cleanName(patch.lastName) : current.lastName,
    preferredName:
      patch.preferredName !== undefined
        ? cleanName(patch.preferredName)
        : current.preferredName,
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
  const preferredName = cleanName(input.preferredName) || firstName;
  return saveUserProfile({
    firstName,
    lastName,
    preferredName,
    onboardedAt: new Date().toISOString(),
  });
}
