/**
 * Sync offline-first: highlights / notes / planProgress → users/{uid}/…
 * Textos bíblicos jamais ici.
 */

import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  onSnapshotsInSync,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureFirebase, getFirebaseDb } from "../../../lib/firebase";
import {
  exportVerseMarkRemoved,
  exportVerseMarkStore,
  exportVerseMarkTouched,
  importVerseMarkStore,
  subscribeVerseMarksRevision,
  clearVerseMarkStore,
} from "../../../verseMarks";
import {
  clearDayNoteStore,
  exportDayNoteStore,
  importDayNoteStore,
  subscribeDayNotes,
} from "../../reading-plans/domain/planDayNote";
import {
  clearPlanProgressStore,
  exportPlanProgressStore,
  importPlanProgressStore,
  subscribePlanProgress,
} from "../../reading-plans/domain/planProgress";
import {
  clearVerseNoteStore,
  exportVerseNoteStore,
  importVerseNoteStore,
  subscribeVerseNotes,
} from "../../../bible/verseNotes";
import {
  userHighlightsDoc,
  userNotesDoc,
  userPlanProgressDoc,
  userVerseNotesDoc,
} from "./userDataPaths";

export type SyncStatus = "idle" | "synced" | "pending" | "offline";

const SYNC_STATUS_EVENT = "biblos-user-sync-status";

let currentUid: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubs: Unsubscribe[] = [];
let localUnsubs: Array<() => void> = [];
let syncStatus: SyncStatus = "idle";
let applyingRemote = false;

function setSyncStatus(next: SyncStatus) {
  if (syncStatus === next) return;
  syncStatus = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SYNC_STATUS_EVENT, { detail: next }),
    );
  }
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function subscribeSyncStatus(
  onChange: (status: SyncStatus) => void,
): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<SyncStatus>).detail;
    onChange(detail ?? getSyncStatus());
  };
  window.addEventListener(SYNC_STATUS_EVENT, handler);
  onChange(syncStatus);
  return () => window.removeEventListener(SYNC_STATUS_EVENT, handler);
}

function pathDoc(db: Firestore, path: string) {
  const parts = path.split("/");
  return doc(db, parts[0]!, parts[1]!, parts[2]!, parts[3]!);
}

async function pushAll(uid: string): Promise<void> {
  const ready = await ensureFirebase();
  if (!ready) return;
  const { db } = ready;
  setSyncStatus(navigator.onLine ? "pending" : "offline");
  const updatedAt = new Date().toISOString();
  await Promise.all([
    setDoc(
      pathDoc(db, userHighlightsDoc(uid)),
      {
        store: exportVerseMarkStore(),
        touched: exportVerseMarkTouched(),
        removed: exportVerseMarkRemoved(),
        updatedAt,
      },
      { merge: true },
    ),
    setDoc(
      pathDoc(db, userNotesDoc(uid)),
      {
        store: exportDayNoteStore(),
        updatedAt,
      },
      { merge: true },
    ),
    setDoc(
      pathDoc(db, userVerseNotesDoc(uid)),
      {
        store: exportVerseNoteStore(),
        updatedAt,
      },
      { merge: true },
    ),
    setDoc(
      pathDoc(db, userPlanProgressDoc(uid)),
      {
        store: exportPlanProgressStore(),
        updatedAt,
      },
      { merge: true },
    ),
  ]);
}

export function queueUserDataPush(uid?: string | null): void {
  const target = uid ?? currentUid;
  if (!target) return;
  if (pushTimer) clearTimeout(pushTimer);
  setSyncStatus(navigator.onLine ? "pending" : "offline");
  pushTimer = setTimeout(() => {
    void pushAll(target).catch((err) => {
      console.warn("[user-sync] push", err);
      setSyncStatus(navigator.onLine ? "pending" : "offline");
    });
  }, 1200);
}

export async function flushUserDataPush(uid?: string | null): Promise<void> {
  const target = uid ?? currentUid;
  if (!target) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await pushAll(target);
}

function applyRemoteHighlights(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const store = (data.store ?? {}) as Parameters<typeof importVerseMarkStore>[0];
  const touched = (data.touched ?? {}) as Parameters<
    typeof importVerseMarkStore
  >[1];
  const removed = (data.removed ?? {}) as Parameters<
    typeof importVerseMarkStore
  >[2];
  applyingRemote = true;
  try {
    importVerseMarkStore(store, touched, removed, true);
  } finally {
    applyingRemote = false;
  }
}

function applyRemoteNotes(data: Record<string, unknown> | undefined) {
  if (!data) return;
  applyingRemote = true;
  try {
    importDayNoteStore(
      (data.store ?? {}) as Parameters<typeof importDayNoteStore>[0],
      true,
    );
  } finally {
    applyingRemote = false;
  }
}

function applyRemoteVerseNotes(data: Record<string, unknown> | undefined) {
  if (!data) return;
  applyingRemote = true;
  try {
    importVerseNoteStore(
      (data.store ?? {}) as Parameters<typeof importVerseNoteStore>[0],
      true,
    );
  } finally {
    applyingRemote = false;
  }
}

function applyRemotePlanProgress(data: Record<string, unknown> | undefined) {
  if (!data) return;
  applyingRemote = true;
  try {
    importPlanProgressStore(
      (data.store ?? {}) as Parameters<typeof importPlanProgressStore>[0],
      true,
    );
  } finally {
    applyingRemote = false;
  }
}

function stopListeners() {
  for (const stop of unsubs) stop();
  unsubs = [];
  for (const stop of localUnsubs) stop();
  localUnsubs = [];
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

/**
 * Démarre sync pour un uid Firebase (anonymous ou authenticated).
 * Pull via onSnapshot + push debounce sur writes locaux.
 */
export async function startUserDataSync(uid: string): Promise<void> {
  if (currentUid === uid && unsubs.length) return;
  stopListeners();
  currentUid = uid;

  const ready = await ensureFirebase();
  if (!ready) {
    setSyncStatus("offline");
    return;
  }
  const { db } = ready;

  unsubs.push(
    onSnapshot(
      pathDoc(db, userHighlightsDoc(uid)),
      (snap) => {
        applyRemoteHighlights(snap.data() as Record<string, unknown> | undefined);
      },
      (err) => console.warn("[user-sync] highlights", err),
    ),
  );
  unsubs.push(
    onSnapshot(
      pathDoc(db, userNotesDoc(uid)),
      (snap) => {
        applyRemoteNotes(snap.data() as Record<string, unknown> | undefined);
      },
      (err) => console.warn("[user-sync] notes", err),
    ),
  );
  unsubs.push(
    onSnapshot(
      pathDoc(db, userVerseNotesDoc(uid)),
      (snap) => {
        applyRemoteVerseNotes(
          snap.data() as Record<string, unknown> | undefined,
        );
      },
      (err) => console.warn("[user-sync] verseNotes", err),
    ),
  );
  unsubs.push(
    onSnapshot(
      pathDoc(db, userPlanProgressDoc(uid)),
      (snap) => {
        applyRemotePlanProgress(
          snap.data() as Record<string, unknown> | undefined,
        );
      },
      (err) => console.warn("[user-sync] planProgress", err),
    ),
  );

  unsubs.push(
    onSnapshotsInSync(db, () => {
      setSyncStatus(navigator.onLine ? "synced" : "offline");
    }),
  );

  const onLocal = () => {
    if (applyingRemote) return;
    queueUserDataPush(uid);
  };
  localUnsubs.push(subscribeVerseMarksRevision(onLocal));
  localUnsubs.push(subscribeDayNotes(onLocal));
  localUnsubs.push(subscribeVerseNotes(onLocal));
  localUnsubs.push(subscribePlanProgress(onLocal));

  // Premier push pour seed cloud si docs vides
  void (async () => {
    try {
      const hi = await getDoc(pathDoc(db, userHighlightsDoc(uid)));
      if (!hi.exists()) await flushUserDataPush(uid);
      else setSyncStatus(navigator.onLine ? "synced" : "offline");
    } catch {
      setSyncStatus(navigator.onLine ? "pending" : "offline");
    }
  })();
}

export function stopUserDataSync(): void {
  stopListeners();
  currentUid = null;
  setSyncStatus("idle");
}

/** Snapshot local avant login sur compte existant (merge). */
export function snapshotLocalUserData() {
  return {
    highlights: {
      store: exportVerseMarkStore(),
      touched: exportVerseMarkTouched(),
      removed: exportVerseMarkRemoved(),
    },
    notes: exportDayNoteStore(),
    verseNotes: exportVerseNoteStore(),
    planProgress: exportPlanProgressStore(),
  };
}

export type LocalUserDataSnapshot = ReturnType<typeof snapshotLocalUserData>;

export function mergeLocalSnapshotIntoStores(
  snapshot: LocalUserDataSnapshot,
): void {
  importVerseMarkStore(
    snapshot.highlights.store,
    snapshot.highlights.touched,
    snapshot.highlights.removed,
    true,
  );
  importDayNoteStore(snapshot.notes, true);
  if (snapshot.verseNotes) importVerseNoteStore(snapshot.verseNotes, true);
  importPlanProgressStore(snapshot.planProgress, true);
}

/** Efface données personnelles locales — conserve Bibles offline. */
export function clearPersonalLocalData(): void {
  clearVerseMarkStore();
  clearDayNoteStore();
  clearVerseNoteStore();
  clearPlanProgressStore();
  try {
    localStorage.removeItem("biblos-activity-v1");
  } catch {
    /* ignore */
  }
}

export async function deleteUserCloudData(uid: string): Promise<void> {
  const db = getFirebaseDb() ?? (await ensureFirebase())?.db;
  if (!db) return;
  await Promise.all([
    deleteDoc(pathDoc(db, userHighlightsDoc(uid))).catch(() => undefined),
    deleteDoc(pathDoc(db, userNotesDoc(uid))).catch(() => undefined),
    deleteDoc(pathDoc(db, userVerseNotesDoc(uid))).catch(() => undefined),
    deleteDoc(pathDoc(db, userPlanProgressDoc(uid))).catch(() => undefined),
  ]);
}

export function exportUserBackupJson(meta?: {
  uid?: string | null;
  email?: string | null;
}): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "biblos",
    meta: meta ?? {},
    highlights: {
      store: exportVerseMarkStore(),
      touched: exportVerseMarkTouched(),
      removed: exportVerseMarkRemoved(),
    },
    notes: exportDayNoteStore(),
    verseNotes: exportVerseNoteStore(),
    planProgress: exportPlanProgressStore(),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadUserBackupJson(filename = "biblos-backup.json"): void {
  const json = exportUserBackupJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
