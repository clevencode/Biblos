/**
 * État métier local → Firestore : progression des plans + SRS flashcards.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  exportCardOverrides,
  importCardOverrides,
  type CardOverride,
} from "../cardOverrides";
import {
  exportPlanProgressStore,
  importPlanProgressStore,
  type PlanProgress,
} from "../planProgress";
import {
  exportDayNoteStore,
  importDayNoteStore,
  type DayNoteRecord,
} from "../planDayNote";
import {
  exportUserFlashcardsFromCatalog,
  importUserFlashcardsFromCloud,
  loadCatalogFromCache,
} from "../catalogSync";
import type { Flashcard } from "../types";
import {
  exportVerseMarkRemoved,
  exportVerseMarkStore,
  exportVerseMarkTouched,
  importVerseMarkStore,
  type VerseMarkStore,
} from "../verseMarks";
import { isFirebaseSignedIn, loadOrCreateProfile } from "../userProfile";
import { getFirebaseAuth } from "./app";
import { getFirestoreDbReady } from "./firestore";
import { USER_STATE_SCHEMA_VERSION, userPrivateStatePath } from "./schema";

const META_KEY = "biblos-firebase-state-meta";

type UserStateMeta = {
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  serverUpdatedAt: string | null;
};

type UserStatePayload = {
  schemaVersion: number;
  updatedAt: string;
  planProgress: Record<string, PlanProgress>;
  flashcardOverrides: Record<string, CardOverride>;
  verseMarks?: VerseMarkStore;
  verseMarkTouched?: Record<string, string>;
  verseMarkRemoved?: Record<string, string>;
  dayNotes?: Record<string, DayNoteRecord>;
  userFlashcards?: Flashcard[];
};

function readMeta(): UserStateMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return { lastPulledAt: null, lastPushedAt: null, serverUpdatedAt: null };
    }
    const parsed = JSON.parse(raw) as UserStateMeta;
    return {
      lastPulledAt: parsed.lastPulledAt ?? null,
      lastPushedAt: parsed.lastPushedAt ?? null,
      serverUpdatedAt: parsed.serverUpdatedAt ?? null,
    };
  } catch {
    return { lastPulledAt: null, lastPushedAt: null, serverUpdatedAt: null };
  }
}

function writeMeta(patch: Partial<UserStateMeta>): void {
  const next = { ...readMeta(), ...patch };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

function currentUid(): string | null {
  const profile = loadOrCreateProfile();
  if (!isFirebaseSignedIn(profile)) return null;
  return getFirebaseAuth()?.currentUser?.uid ?? profile.firebaseUid ?? null;
}

function buildLocalPayload(): UserStatePayload {
  const catalog = loadCatalogFromCache();
  return {
    schemaVersion: USER_STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    planProgress: exportPlanProgressStore(),
    flashcardOverrides: exportCardOverrides(),
    verseMarks: exportVerseMarkStore(),
    verseMarkTouched: exportVerseMarkTouched(),
    verseMarkRemoved: exportVerseMarkRemoved(),
    dayNotes: exportDayNoteStore(),
    userFlashcards: catalog ? exportUserFlashcardsFromCatalog(catalog) : [],
  };
}

function applyRemoteUserState(data: Partial<UserStatePayload>): boolean {
  let changed = false;
  if (data.planProgress && typeof data.planProgress === "object") {
    importPlanProgressStore(data.planProgress, true);
    changed = true;
  }
  if (data.flashcardOverrides && typeof data.flashcardOverrides === "object") {
    importCardOverrides(data.flashcardOverrides, true);
    changed = true;
  }
  if (data.verseMarks && typeof data.verseMarks === "object") {
    if (
      importVerseMarkStore(
        data.verseMarks,
        data.verseMarkTouched ?? {},
        data.verseMarkRemoved ?? {},
        true,
      )
    ) {
      changed = true;
    }
  }
  if (data.dayNotes && typeof data.dayNotes === "object") {
    if (importDayNoteStore(data.dayNotes, true)) changed = true;
  }
  if (Array.isArray(data.userFlashcards) && data.userFlashcards.length) {
    if (importUserFlashcardsFromCloud(data.userFlashcards)) changed = true;
  }
  return changed;
}

export async function pushUserStateToCloud(): Promise<{ ok: boolean; error?: string }> {
  const uid = currentUid();
  if (!uid) return { ok: false, error: "non connecté" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: "offline" };
  }

  const db = await getFirestoreDbReady();
  if (!db) return { ok: false, error: "Firestore indisponible" };

  const stateRef = doc(db, userPrivateStatePath(uid));
  try {
    const remoteSnap = await getDoc(stateRef);
    if (remoteSnap.exists()) {
      const remote = remoteSnap.data() as Partial<UserStatePayload>;
      if (applyRemoteUserState(remote) && typeof window !== "undefined") {
        window.dispatchEvent(new Event("biblos-user-state-pulled"));
      }
    }
  } catch {
    /* push best-effort même si lecture distante échoue */
  }

  const payload = buildLocalPayload();
  try {
    await setDoc(stateRef, payload, { merge: true });
    writeMeta({
      lastPushedAt: payload.updatedAt,
      serverUpdatedAt: payload.updatedAt,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "push state",
    };
  }
}

export async function pullUserStateFromCloud(): Promise<{
  ok: boolean;
  applied: boolean;
  error?: string;
}> {
  const uid = currentUid();
  if (!uid) return { ok: false, applied: false, error: "non connecté" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, applied: false, error: "offline" };
  }

  const db = await getFirestoreDbReady();
  if (!db) return { ok: false, applied: false, error: "Firestore indisponible" };

  try {
    const snap = await getDoc(doc(db, userPrivateStatePath(uid)));
    if (!snap.exists()) {
      writeMeta({ lastPulledAt: new Date().toISOString() });
      return { ok: true, applied: false };
    }

    const data = snap.data() as Partial<UserStatePayload>;
    const remoteUpdated =
      typeof data.updatedAt === "string" ? data.updatedAt : null;
    const meta = readMeta();
    if (remoteUpdated && meta.serverUpdatedAt === remoteUpdated) {
      return { ok: true, applied: false };
    }

    const applied = applyRemoteUserState(data);

    const pulledAt = new Date().toISOString();
    writeMeta({
      lastPulledAt: pulledAt,
      serverUpdatedAt: remoteUpdated,
    });
    if (applied && typeof window !== "undefined") {
      window.dispatchEvent(new Event("biblos-user-state-pulled"));
    }
    return { ok: true, applied };
  } catch (error) {
    return {
      ok: false,
      applied: false,
      error: error instanceof Error ? error.message : "pull state",
    };
  }
}
