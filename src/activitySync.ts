/**
 * Sync journal d’activité local ↔ Notion (NOTION_ACTIVITY_DB).
 * Admin clevencode : UserId stable + pull multi-appareils.
 */
import { apiUrl } from "./apiBase";
import {
  mergeRemoteActivityEvents,
  remapAdminActivityUserIds,
  resolveActivityUserId,
  type ActivityEvent,
} from "./activityLog";
import {
  CLEVENCODE_ADMIN_USER_ID,
  isClevencodeAdmin,
  loadOrCreateProfile,
  preferredDisplayName,
} from "./userProfile";

export type ActivitySyncResult = {
  ok: boolean;
  error?: string;
  url?: string;
  hasToken?: boolean;
  queued?: boolean;
};

type ActivityOutboxItem = {
  localId: string;
  userId: string;
  displayName: string;
  type: string;
  meta?: ActivityEvent["meta"];
  at: string;
};

const OUTBOX_KEY = "biblos-activity-outbox-v1";
const MAX_OUTBOX = 120;

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

export function countActivityOutbox(): number {
  return loadOutbox().length;
}

function enqueueItem(item: ActivityOutboxItem): void {
  const next = loadOutbox().filter((row) => row.localId !== item.localId);
  next.unshift(item);
  writeOutbox(next);
}

function resolveOutboxUserId(eventUserId: string): string {
  return resolveActivityUserId(eventUserId);
}

/** Met un événement local en file pour sync Notion. */
export function enqueueActivityEvent(event: ActivityEvent): void {
  if (!event?.id || !event.userId || !event.type) return;
  const profile = loadOrCreateProfile();
  enqueueItem({
    localId: event.id,
    userId: resolveOutboxUserId(event.userId),
    displayName: preferredDisplayName(profile),
    type: event.type,
    ...(event.meta ? { meta: event.meta } : {}),
    at: event.at || new Date().toISOString(),
  });
}

async function postActivity(
  item: ActivityOutboxItem,
): Promise<ActivitySyncResult & { status?: number }> {
  const response = await fetch(apiUrl("/api/activity"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      localId: item.localId,
      userId: resolveOutboxUserId(item.userId),
      displayName: item.displayName,
      type: item.type,
      meta: item.meta ?? null,
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
      error: data.error || "Envoi activité échoué",
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
export async function flushActivityOutbox(): Promise<{
  sent: number;
  remaining: number;
}> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: 0, remaining: loadOutbox().length };
  }
  remapAdminActivityUserIds();
  const queue = loadOutbox().map((item) => ({
    ...item,
    userId: resolveOutboxUserId(item.userId),
  }));
  if (!queue.length) return { sent: 0, remaining: 0 };
  writeOutbox(queue);

  const remaining: ActivityOutboxItem[] = [];
  let sent = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i]!;
    try {
      const result = await postActivity(item);
      if (result.ok) {
        sent += 1;
        continue;
      }
      const retryLater =
        result.hasToken === false ||
        (typeof result.status === "number" && result.status >= 500);
      if (retryLater) {
        remaining.push(...queue.slice(i));
        break;
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

/** Pull Notion → journal local (admin multi-appareils). */
export async function pullAdminActivityFromNotion(): Promise<{
  ok: boolean;
  merged: number;
  error?: string;
}> {
  if (!isClevencodeAdmin()) return { ok: true, merged: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, merged: 0, error: "offline" };
  }
  try {
    const response = await fetch(
      apiUrl(`/api/activity?userId=${encodeURIComponent(CLEVENCODE_ADMIN_USER_ID)}&limit=120`),
    );
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      items?: Array<Partial<ActivityEvent> & { id?: string; type?: string; at?: string }>;
    };
    if (!data.ok) {
      return { ok: false, merged: 0, error: data.error || "pull activité échoué" };
    }
    remapAdminActivityUserIds();
    const merged = mergeRemoteActivityEvents(data.items || []);
    return { ok: true, merged };
  } catch (error) {
    return {
      ok: false,
      merged: 0,
      error: error instanceof Error ? error.message : "réseau",
    };
  }
}

/** Push outbox + pull admin (si clevencode). */
export async function syncAdminActivityAcrossDevices(): Promise<void> {
  await flushActivityOutbox();
  if (isClevencodeAdmin()) {
    await pullAdminActivityFromNotion();
  }
}

/** Enfile + tente un envoi immédiat (non bloquant pour l’UI). */
export function scheduleActivitySync(event: ActivityEvent | null): void {
  if (!event) return;
  enqueueActivityEvent(event);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  void flushActivityOutbox().catch(() => undefined);
}

export async function pushActivityEvent(
  event: ActivityEvent,
): Promise<ActivitySyncResult> {
  const profile = loadOrCreateProfile();
  const item: ActivityOutboxItem = {
    localId: event.id,
    userId: resolveOutboxUserId(event.userId),
    displayName: preferredDisplayName(profile),
    type: event.type,
    ...(event.meta ? { meta: event.meta } : {}),
    at: event.at || new Date().toISOString(),
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueueItem(item);
    return { ok: true, queued: true };
  }

  try {
    const result = await postActivity(item);
    if (result.ok) return result;
    enqueueItem(item);
    return { ok: true, queued: true, hasToken: result.hasToken, error: result.error };
  } catch (error) {
    if (isOfflineError(error)) {
      enqueueItem(item);
      return { ok: true, queued: true };
    }
    enqueueItem(item);
    return {
      ok: true,
      queued: true,
      error: error instanceof Error ? error.message : "réseau",
    };
  }
}
