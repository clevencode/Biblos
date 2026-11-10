/** Profil local minimal (identifiant stable pour l’historique de lecture). */

const PROFILE_KEY = "biblos-user-profile";

export type UserProfile = {
  id: string;
  createdAt: string;
};

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : null;
  if (!id) return null;
  return {
    id,
    createdAt:
      typeof data.createdAt === "string" && data.createdAt
        ? data.createdAt
        : new Date().toISOString(),
  };
}

function writeProfile(profile: UserProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* quota */
  }
}

/** Efface profil + clés locales Biblos (clean slate). */
export function wipeLocalUserData(): void {
  const keys = [
    PROFILE_KEY,
    "biblos-activity-v1",
    "biblos-ui",
    "biblos.verseMarks",
    "biblos.verseMarks.touched",
    "biblos.verseMarks.removed",
    "biblos-bible-prefs",
    "biblos-theme",
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function loadOrCreateProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = parseProfile(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    /* ignore */
  }
  const profile: UserProfile = { id: newId(), createdAt: new Date().toISOString() };
  writeProfile(profile);
  return profile;
}
