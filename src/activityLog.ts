/** Journal d’activité local (lecture, marques, thème) — sync via user-sync. */

import { loadOrCreateProfile } from "./userProfile";
import {
  persistLocalString,
  removePersistedString,
} from "./services/storage/StorageAdapter";

export const ACTIVITY_KEY = "biblos-activity-v1";
export const MAX_EVENTS = 300;
const ACTIVITY_EVENT = "biblos-activity";

export const ACTIVITY_TRACKING_ENABLED = true;
export const ACTIVITY_UI_ENABLED = true;

export type ActivityType =
  | "verse.mark"
  | "theme.change"
  | "bible.read";

export type ActivityEvent = {
  id: string;
  userId: string;
  type: ActivityType;
  at: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type ActivityStore = {
  events: ActivityEvent[];
};

function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStore(raw: unknown): ActivityStore {
  if (!raw || typeof raw !== "object") return { events: [] };
  const events = (raw as ActivityStore).events;
  if (!Array.isArray(events)) return { events: [] };
  const cleaned: ActivityEvent[] = [];
  for (const item of events) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as ActivityEvent).id || "").trim();
    const userId = String((item as ActivityEvent).userId || "").trim();
    const type = (item as ActivityEvent).type;
    const at = String((item as ActivityEvent).at || "").trim();
    if (!id || !userId || !at) continue;
    if (type !== "verse.mark" && type !== "theme.change" && type !== "bible.read") {
      continue;
    }
    cleaned.push({
      id,
      userId,
      type,
      at,
      ...((item as ActivityEvent).meta
        ? { meta: (item as ActivityEvent).meta }
        : {}),
    });
  }
  return { events: cleaned };
}

function readStore(): ActivityStore {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return { events: [] };
    return normalizeStore(JSON.parse(raw) as unknown);
  } catch {
    return { events: [] };
  }
}

function writeStore(store: ActivityStore): void {
  try {
    const capped: ActivityStore = {
      events: store.events.slice(0, MAX_EVENTS),
    };
    persistLocalString(ACTIVITY_KEY, JSON.stringify(capped));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
    }
  } catch {
    /* quota / private mode */
  }
}

export function resolveActivityUserId(userId?: string): string {
  const profile = loadOrCreateProfile();
  const uid = String(userId || profile.id || "").trim();
  return uid || profile.id;
}

/** Ids de utilizador a incluir no Historique (uid actual + legado pré-login). */
export function activityUserIdAliases(userId?: string): Set<string> {
  const profile = loadOrCreateProfile();
  const primary = resolveActivityUserId(userId);
  const aliases = new Set<string>([primary]);
  const legacy = profile.legacyLocalId?.trim();
  if (legacy) aliases.add(legacy);
  if (profile.id?.trim()) aliases.add(profile.id.trim());
  return aliases;
}

export function appendActivity(
  type: ActivityType,
  meta?: ActivityEvent["meta"],
  userId?: string,
): ActivityEvent | null {
  const uid = resolveActivityUserId(userId);
  const event: ActivityEvent = {
    id: newEventId(),
    userId: uid,
    type,
    at: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };
  if (!ACTIVITY_TRACKING_ENABLED) return null;
  const store = readStore();
  store.events = [event, ...store.events].slice(0, MAX_EVENTS);
  writeStore(store);
  return event;
}

export function listBibleReadingHistory(
  userId?: string,
  limit = 30,
): ActivityEvent[] {
  if (!ACTIVITY_TRACKING_ENABLED) return [];
  const aliases = activityUserIdAliases(userId);
  return readStore()
    .events.filter(
      (event) => aliases.has(event.userId) && event.type === "bible.read",
    )
    .sort((a, b) => {
      const ta = Date.parse(a.at) || 0;
      const tb = Date.parse(b.at) || 0;
      return tb - ta;
    })
    .slice(0, Math.max(1, limit));
}

export function removeActivityById(id: string, userId?: string): boolean {
  if (!ACTIVITY_TRACKING_ENABLED) return false;
  const target = String(id || "").trim();
  if (!target) return false;
  const aliases = activityUserIdAliases(userId);
  const store = readStore();
  const next = store.events.filter(
    (event) => !(event.id === target && aliases.has(event.userId)),
  );
  if (next.length === store.events.length) return false;
  writeStore({ events: next });
  return true;
}

export function clearBibleReadingHistory(userId?: string): number {
  if (!ACTIVITY_TRACKING_ENABLED) return 0;
  const aliases = activityUserIdAliases(userId);
  const store = readStore();
  const next = store.events.filter(
    (event) =>
      !(aliases.has(event.userId) && event.type === "bible.read"),
  );
  const removed = store.events.length - next.length;
  if (removed > 0) writeStore({ events: next });
  return removed;
}

export function recordBibleRead(input: {
  bookId: string;
  chapterId: string;
  verse?: number | null;
  label?: string;
  userId?: string;
  /** Isolamento de escopo — obrigatório para novas leituras. */
  versionId?: string;
  language?: string;
  versionBadge?: string;
  localizedBookName?: string;
}): ActivityEvent | null {
  if (!ACTIVITY_TRACKING_ENABLED) return null;
  const bookId = String(input.bookId || "").trim().toUpperCase();
  const chapterId = String(input.chapterId || "").trim();
  if (!bookId || !chapterId) return null;
  const versionId = String(input.versionId || "s21").trim() || "s21";
  const usfm = `${bookId}.${chapterId}`;
  const uid = input.userId ?? loadOrCreateProfile().id;
  const recent = listBibleReadingHistory(uid, 1)[0];
  const recentVersion = String(recent?.meta?.versionId || "s21");
  if (
    recent?.meta?.usfm === usfm &&
    recentVersion === versionId &&
    Date.now() - new Date(recent.at).getTime() < 90_000
  ) {
    return null;
  }
  const verse =
    input.verse != null && Number.isFinite(input.verse) ? Number(input.verse) : null;
  const localizedBookName = String(input.localizedBookName || "").trim();
  const label =
    String(input.label || "").trim() ||
    (verse
      ? `${localizedBookName || bookId} ${chapterId}.${verse}`
      : `${localizedBookName || bookId} ${chapterId}`);
  return appendActivity(
    "bible.read",
    {
      usfm,
      bookId,
      chapterId,
      verse,
      label,
      versionId,
      language: String(input.language || "").trim() || null,
      versionBadge: String(input.versionBadge || "").trim() || null,
      localizedBookName: localizedBookName || null,
    },
    uid,
  );
}

export function formatActivityWhen(iso: string, localeTag = "fr-FR"): string {
  try {
    return new Intl.DateTimeFormat(localeTag, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

export function exportActivityStore(): ActivityStore {
  return readStore();
}

/** Substitui o journal (fusão feita pelo user-sync); mais recente primeiro. */
export function replaceActivityStore(incoming: ActivityStore): void {
  const { events } = normalizeStore(incoming);
  events.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  writeStore({ events });
}

export function clearActivityStore(): void {
  removePersistedString(ACTIVITY_KEY);
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
    }
  } catch {
    /* ignore */
  }
}

export function subscribeActivity(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => onChange();
  window.addEventListener(ACTIVITY_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(ACTIVITY_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * Reescreve userId legado → uid Firebase (antes do flush sync).
 * @returns true se algum evento mudou.
 */
export function reassignActivityUserIds(
  fromUserIds: Iterable<string>,
  toUserId: string,
): boolean {
  const target = String(toUserId || "").trim();
  if (!target) return false;
  const from = new Set(
    [...fromUserIds].map((id) => String(id || "").trim()).filter(Boolean),
  );
  from.delete(target);
  if (!from.size) return false;
  const store = readStore();
  let changed = false;
  const events = store.events.map((event) => {
    if (!from.has(event.userId)) return event;
    changed = true;
    return { ...event, userId: target };
  });
  if (!changed) return false;
  writeStore({ events });
  return true;
}
