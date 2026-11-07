/**
 * Journal d’activité utilisateur → Firestore.
 */
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { ActivityEvent, ActivityType } from "../activityLog";
import {
  ACTIVITY_TYPES,
  mergeRemoteActivityEvents,
  resolveActivityUserId,
} from "../activityLog";
import { getFirebaseAuth } from "./app";
import { firestoreUserRoot, getFirestoreDb } from "./firestore";
import { isFirebaseSignedIn, loadOrCreateProfile } from "../userProfile";

const OUTBOX_KEY = "biblos-activity-outbox-v1";
const MAX_OUTBOX = 120;

type ActivityOutboxItem = {
  localId: string;
  userId: string;
  type: string;
  meta?: ActivityEvent["meta"];
  at: string;
};

function loadOutbox(): ActivityOutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityOutboxItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.localId === "string" &&
        typeof item.userId === "string" &&
        typeof item.type === "string" &&
        item.type.trim(),
    );
  } catch {
    return [];
  }
}

function writeOutbox(items: ActivityOutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(0, MAX_OUTBOX)));
  } catch {
    /* private mode */
  }
}

function currentFirestoreUid(): string | null {
  const profile = loadOrCreateProfile();
  if (!isFirebaseSignedIn(profile)) return null;
  const authUid = getFirebaseAuth()?.currentUser?.uid;
  if (authUid) return authUid;
  return profile.firebaseUid?.trim() || null;
}

function sanitizeMeta(meta: ActivityEvent["meta"] | undefined): Record<string, string | number | boolean | null> | null {
  if (!meta || typeof meta !== "object") return null;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : null;
}

async function writeEventToFirestore(
  uid: string,
  item: ActivityOutboxItem,
): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  const type = item.type.trim() as ActivityType;
  if (!ACTIVITY_TYPES.has(type)) return false;

  const ref = doc(db, `${firestoreUserRoot(uid)}/activity/${item.localId}`);
  await setDoc(
    ref,
    {
      type,
      at: item.at,
      userId: resolveActivityUserId(item.userId),
      meta: sanitizeMeta(item.meta),
    },
    { merge: true },
  );
  return true;
}

export function enqueueActivityForCloud(event: ActivityEvent): void {
  if (!event?.id) return;
  const uid = currentFirestoreUid();
  if (!uid) return;
  const next = loadOutbox().filter((row) => row.localId !== event.id);
  next.unshift({
    localId: event.id,
    userId: resolveActivityUserId(event.userId),
    type: event.type,
    ...(event.meta ? { meta: event.meta } : {}),
    at: event.at || new Date().toISOString(),
  });
  writeOutbox(next);
}

export async function flushActivityOutboxToCloud(): Promise<{
  sent: number;
  remaining: number;
}> {
  const uid = currentFirestoreUid();
  if (!uid || typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: 0, remaining: loadOutbox().length };
  }

  const queue = loadOutbox();
  if (!queue.length) return { sent: 0, remaining: 0 };

  const remaining: ActivityOutboxItem[] = [];
  let sent = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i]!;
    try {
      const ok = await writeEventToFirestore(uid, item);
      if (ok) sent += 1;
      else remaining.push(item);
    } catch {
      remaining.push(...queue.slice(i));
      break;
    }
  }

  writeOutbox(remaining);
  return { sent, remaining: remaining.length };
}

function docToPartialActivity(
  snap: QueryDocumentSnapshot,
  uid: string,
): Partial<ActivityEvent> & { id?: string } {
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    userId: typeof data.userId === "string" ? data.userId : uid,
    type: typeof data.type === "string" ? (data.type as ActivityType) : undefined,
    at: typeof data.at === "string" ? data.at : undefined,
    meta:
      data.meta && typeof data.meta === "object"
        ? (data.meta as ActivityEvent["meta"])
        : undefined,
  };
}

/** Fusionne l’historique Firestore dans le journal local (multi-appareil). */
export async function pullActivityFromCloud(limitCount = 120): Promise<{
  ok: boolean;
  merged: number;
  error?: string;
}> {
  const uid = currentFirestoreUid();
  if (!uid) return { ok: true, merged: 0 };
  const db = getFirestoreDb();
  if (!db) return { ok: false, merged: 0, error: "Firestore indisponible" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, merged: 0, error: "offline" };
  }

  try {
    const q = query(
      collection(db, `${firestoreUserRoot(uid)}/activity`),
      orderBy("at", "desc"),
      limit(Math.max(1, Math.min(limitCount, 300))),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => docToPartialActivity(d, uid));
    const merged = mergeRemoteActivityEvents(items);
    return { ok: true, merged };
  } catch (error) {
    return {
      ok: false,
      merged: 0,
      error: error instanceof Error ? error.message : "Firestore",
    };
  }
}

export function scheduleActivityCloudSync(event: ActivityEvent | null): void {
  if (!event) return;
  enqueueActivityForCloud(event);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  void flushActivityOutboxToCloud().catch(() => undefined);
}
