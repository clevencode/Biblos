/**
 * Envoi d’un message admin → Notion (catégorie + corps, Status Nouveau).
 * Hors ligne : file locale, flush dès que le réseau revient.
 */
import { preferredDisplayName, type UserProfile } from "./userProfile";

export type AdminMessageCategoryId =
  | "bug"
  | "suggestion"
  | "complaint"
  | "question"
  | "other";

export type AdminMessageCategory = {
  id: AdminMessageCategoryId;
  /** Libellé UI (FR) — aussi stocké dans Notion Category. */
  label: string;
};

/** 5 types max — évite la paralysie de choix (best practice feedback forms). */
export const ADMIN_MESSAGE_CATEGORIES: readonly AdminMessageCategory[] = [
  { id: "bug", label: "Bug" },
  { id: "suggestion", label: "Suggestion" },
  { id: "complaint", label: "Réclamation" },
  { id: "question", label: "Question" },
  { id: "other", label: "Autre" },
] as const;

export function adminMessageCategoryLabel(
  id: string | null | undefined,
): string | null {
  const hit = ADMIN_MESSAGE_CATEGORIES.find((item) => item.id === id);
  return hit?.label ?? null;
}

export type AdminMessageResult = {
  ok: boolean;
  error?: string;
  url?: string;
  hasToken?: boolean;
  /** Mis en file locale (sera envoyé dès qu’il y a du réseau). */
  queued?: boolean;
};

type AdminMessageOutboxItem = {
  localId: string;
  userId: string;
  displayName: string;
  category: string;
  body: string;
  at: string;
};

const OUTBOX_KEY = "biblos-admin-message-outbox-v1";
const MAX_OUTBOX = 40;

function newLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadOutbox(): AdminMessageOutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AdminMessageOutboxItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.localId === "string" &&
        typeof item.userId === "string" &&
        typeof item.category === "string" &&
        typeof item.body === "string" &&
        item.body.trim(),
    );
  } catch {
    return [];
  }
}

function writeOutbox(items: AdminMessageOutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(0, MAX_OUTBOX)));
  } catch {
    /* private mode */
  }
}

export function countAdminMessageOutbox(): number {
  return loadOutbox().length;
}

function enqueueAdminMessage(item: AdminMessageOutboxItem): void {
  const next = loadOutbox().filter((row) => row.localId !== item.localId);
  next.unshift(item);
  writeOutbox(next);
}

async function postAdminMessage(
  item: AdminMessageOutboxItem,
): Promise<AdminMessageResult & { status?: number }> {
  const response = await fetch("/api/admin-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      localId: item.localId,
      userId: item.userId,
      displayName: item.displayName,
      category: item.category,
      title: item.category,
      body: item.body,
      at: item.at,
    }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    url?: string;
    hasToken?: boolean;
  };
  if (!data.ok) {
    return {
      ok: false,
      error: data.error || "Envoi échoué",
      hasToken: data.hasToken,
      status: response.status,
    };
  }
  return { ok: true, url: data.url, hasToken: data.hasToken, status: response.status };
}

function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error || "");
  return /failed to fetch|network|offline|load failed/i.test(message);
}

/** Envoie la file locale vers Notion. */
export async function flushAdminMessageOutbox(): Promise<{
  sent: number;
  remaining: number;
}> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: 0, remaining: loadOutbox().length };
  }
  const queue = loadOutbox();
  if (!queue.length) return { sent: 0, remaining: 0 };

  const remaining: AdminMessageOutboxItem[] = [];
  let sent = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i]!;
    try {
      const result = await postAdminMessage(item);
      if (result.ok) {
        sent += 1;
        continue;
      }
      remaining.push(...queue.slice(i));
      break;
    } catch {
      remaining.push(...queue.slice(i));
      break;
    }
  }

  writeOutbox(remaining);
  return { sent, remaining: remaining.length };
}

export async function sendAdminMessage(
  profile: UserProfile,
  input: { category: AdminMessageCategoryId; body: string },
): Promise<AdminMessageResult> {
  const categoryId = input.category;
  const categoryLabel = adminMessageCategoryLabel(categoryId);
  const body = String(input.body || "").trim();
  if (!categoryLabel) return { ok: false, error: "Catégorie requise" };
  if (!body) return { ok: false, error: "Message vide" };
  if (body.length > 2000) return { ok: false, error: "Message trop long (2000 max)" };

  const item: AdminMessageOutboxItem = {
    localId: newLocalId(),
    userId: profile.id,
    displayName: preferredDisplayName(profile),
    category: categoryLabel,
    body,
    at: new Date().toISOString(),
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueueAdminMessage(item);
    return { ok: true, queued: true };
  }

  try {
    const result = await postAdminMessage(item);
    if (result.ok) return result;
    const retryLater =
      result.hasToken === false ||
      (typeof result.status === "number" && result.status >= 500);
    if (retryLater) {
      enqueueAdminMessage(item);
      return { ok: true, queued: true, hasToken: result.hasToken };
    }
    return {
      ok: false,
      error: result.error || "Envoi échoué",
      hasToken: result.hasToken,
    };
  } catch (error) {
    if (isOfflineError(error)) {
      enqueueAdminMessage(item);
      return { ok: true, queued: true };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "réseau",
    };
  }
}
