/**
 * Messages d’aide utilisateur → Firestore (pas NOTION_MESSAGES_DB).
 */
import { doc, setDoc } from "firebase/firestore";
import type { AdminMessageResult } from "../adminMessage";
import { adminMessageCategoryLabel, type AdminMessageCategoryId } from "../adminMessage";
import {
  isFirebaseSignedIn,
  preferredDisplayName,
  type UserProfile,
} from "../userProfile";
import { getFirebaseAuth } from "./app";
import { firestoreUserRoot, getFirestoreDbReady } from "./firestore";

const OUTBOX_KEY = "biblos-admin-message-outbox-v1";

type SupportOutboxItem = {
  localId: string;
  userId: string;
  displayName: string;
  category: string;
  body: string;
  at: string;
};

function loadOutbox(): SupportOutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SupportOutboxItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: SupportOutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    /* private mode */
  }
}

async function postSupportMessage(item: SupportOutboxItem): Promise<AdminMessageResult> {
  const db = await getFirestoreDbReady();
  const auth = getFirebaseAuth()?.currentUser;
  if (!db || !auth) {
    return { ok: false, error: "Connexion requise" };
  }

  await setDoc(doc(db, `${firestoreUserRoot(auth.uid)}/support/${item.localId}`), {
    category: item.category,
    body: item.body,
    displayName: item.displayName,
    at: item.at,
    status: "nouveau",
  });
  return { ok: true };
}

export async function flushSupportOutboxToCloud(): Promise<{
  sent: number;
  remaining: number;
}> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: 0, remaining: loadOutbox().length };
  }
  const queue = loadOutbox();
  if (!queue.length) return { sent: 0, remaining: 0 };

  const remaining: SupportOutboxItem[] = [];
  let sent = 0;
  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i]!;
    try {
      const result = await postSupportMessage(item);
      if (result.ok) sent += 1;
      else remaining.push(...queue.slice(i));
      if (!result.ok) break;
    } catch {
      remaining.push(...queue.slice(i));
      break;
    }
  }
  writeOutbox(remaining);
  return { sent, remaining: remaining.length };
}

export async function sendSupportMessageToCloud(
  profile: UserProfile,
  input: { category: AdminMessageCategoryId; body: string },
): Promise<AdminMessageResult> {
  if (!isFirebaseSignedIn(profile)) {
    return { ok: false, error: "Connecte-toi pour envoyer un message" };
  }
  const categoryLabel = adminMessageCategoryLabel(input.category);
  const body = String(input.body || "").trim();
  if (!categoryLabel) return { ok: false, error: "Catégorie requise" };
  if (!body) return { ok: false, error: "Message vide" };
  if (body.length > 2000) return { ok: false, error: "Message trop long (2000 max)" };

  const localId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `m-${Date.now().toString(36)}`;

  const item: SupportOutboxItem = {
    localId,
    userId: profile.id,
    displayName: preferredDisplayName(profile),
    category: categoryLabel,
    body,
    at: new Date().toISOString(),
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const next = [item, ...loadOutbox().filter((r) => r.localId !== localId)];
    writeOutbox(next);
    return { ok: true, queued: true };
  }

  try {
    const result = await postSupportMessage(item);
    if (result.ok) return result;
    const next = [item, ...loadOutbox().filter((r) => r.localId !== localId)];
    writeOutbox(next);
    return { ok: true, queued: true, error: result.error };
  } catch (error) {
    const next = [item, ...loadOutbox().filter((r) => r.localId !== localId)];
    writeOutbox(next);
    return {
      ok: true,
      queued: true,
      error: error instanceof Error ? error.message : "réseau",
    };
  }
}
