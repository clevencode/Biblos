/** Journal d’activité local, indexé par userId (pas par nom). */

import { loadOrCreateProfile } from "./userProfile";

const ACTIVITY_KEY = "biblos-activity-v1";
const MAX_EVENTS = 300;

export type ActivityType =
  | "app.open"
  | "onboarding.complete"
  | "plan.day_read"
  | "flashcard.create"
  | "verse.mark"
  | "theme.change"
  | "profile.update"
  | "bible.read";

export type ActivityEvent = {
  id: string;
  userId: string;
  type: ActivityType;
  at: string;
  meta?: Record<string, string | number | boolean | null>;
};

type ActivityStore = {
  events: ActivityEvent[];
};

function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStore(): ActivityStore {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return { events: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { events: [] };
    const events = (parsed as ActivityStore).events;
    return { events: Array.isArray(events) ? events : [] };
  } catch {
    return { events: [] };
  }
}

function writeStore(store: ActivityStore): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function appendActivity(
  type: ActivityType,
  meta?: ActivityEvent["meta"],
  userId?: string,
): ActivityEvent {
  const uid = userId ?? loadOrCreateProfile().id;
  const event: ActivityEvent = {
    id: newEventId(),
    userId: uid,
    type,
    at: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };
  const store = readStore();
  store.events = [event, ...store.events].slice(0, MAX_EVENTS);
  writeStore(store);
  void import("./activitySync")
    .then(({ enqueueActivityNotionSync }) => {
      enqueueActivityNotionSync(event);
    })
    .catch(() => {
      /* ignore */
    });
  return event;
}

export function listActivityForUser(
  userId?: string,
  limit = 40,
): ActivityEvent[] {
  const uid = userId ?? loadOrCreateProfile().id;
  return readStore()
    .events.filter((event) => event.userId === uid)
    .slice(0, Math.max(1, limit));
}

export function listBibleReadingHistory(
  userId?: string,
  limit = 30,
): ActivityEvent[] {
  const uid = userId ?? loadOrCreateProfile().id;
  return readStore()
    .events.filter((event) => event.userId === uid && event.type === "bible.read")
    .slice(0, Math.max(1, limit));
}

export function removeActivityById(id: string, userId?: string): boolean {
  const target = String(id || "").trim();
  if (!target) return false;
  const uid = userId ?? loadOrCreateProfile().id;
  const store = readStore();
  const next = store.events.filter(
    (event) => !(event.id === target && event.userId === uid),
  );
  if (next.length === store.events.length) return false;
  writeStore({ events: next });
  return true;
}

/** Supprime toutes les lectures bibliques de l’utilisateur. */
export function clearBibleReadingHistory(userId?: string): number {
  const uid = userId ?? loadOrCreateProfile().id;
  const store = readStore();
  const next = store.events.filter(
    (event) => !(event.userId === uid && event.type === "bible.read"),
  );
  const removed = store.events.length - next.length;
  if (removed > 0) writeStore({ events: next });
  return removed;
}

/** Enregistre une lecture de chapitre (ignore doublon immédiat). */
export function recordBibleRead(input: {
  bookId: string;
  chapterId: string;
  verse?: number | null;
  label?: string;
  userId?: string;
}): ActivityEvent | null {
  const bookId = String(input.bookId || "").trim().toUpperCase();
  const chapterId = String(input.chapterId || "").trim();
  if (!bookId || !chapterId) return null;
  const usfm = `${bookId}.${chapterId}`;
  const uid = input.userId ?? loadOrCreateProfile().id;
  const recent = listBibleReadingHistory(uid, 1)[0];
  if (
    recent?.meta?.usfm === usfm &&
    Date.now() - new Date(recent.at).getTime() < 90_000
  ) {
    return null;
  }
  const verse =
    input.verse != null && Number.isFinite(input.verse) ? Number(input.verse) : null;
  const label =
    String(input.label || "").trim() ||
    (verse ? `${bookId} ${chapterId}.${verse}` : `${bookId} ${chapterId}`);
  return appendActivity(
    "bible.read",
    { usfm, bookId, chapterId, verse, label },
    uid,
  );
}

export function activityTypeLabel(type: ActivityType): string {
  switch (type) {
    case "app.open":
      return "Ouverture de l’app";
    case "onboarding.complete":
      return "Profil créé";
    case "plan.day_read":
      return "Jour de plan lu";
    case "flashcard.create":
      return "Flashcard créée";
    case "verse.mark":
      return "Verset marqué";
    case "theme.change":
      return "Thème modifié";
    case "profile.update":
      return "Profil mis à jour";
    case "bible.read":
      return "Lecture biblique";
    default:
      return "Activité";
  }
}

export function formatActivityWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}
