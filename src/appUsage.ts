/**
 * Temps passé dans l’app (foreground) — seul métrique de « track » user → Notion.
 */

const STORE_KEY = "biblos-app-usage-v1";
const TICK_MS = 15_000;
const SYNC_EVERY_MS = 5 * 60_000;

type UsageStore = {
  /** Minutes cumulées (entiers). */
  minutes: number;
  /** Ms déjà comptés dans la minute en cours. */
  leftoverMs: number;
  lastSyncedMinutes: number;
  updatedAt: string;
};

function readStore(): UsageStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      return { minutes: 0, leftoverMs: 0, lastSyncedMinutes: 0, updatedAt: new Date().toISOString() };
    }
    const parsed = JSON.parse(raw) as Partial<UsageStore>;
    return {
      minutes: Math.max(0, Math.floor(Number(parsed.minutes) || 0)),
      leftoverMs: Math.max(0, Math.floor(Number(parsed.leftoverMs) || 0)),
      lastSyncedMinutes: Math.max(0, Math.floor(Number(parsed.lastSyncedMinutes) || 0)),
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return { minutes: 0, leftoverMs: 0, lastSyncedMinutes: 0, updatedAt: new Date().toISOString() };
  }
}

function writeStore(store: UsageStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

export function getTimeSpentMinutes(): number {
  return readStore().minutes;
}

export function markTimeSpentSynced(minutes = getTimeSpentMinutes()): void {
  const store = readStore();
  store.lastSyncedMinutes = Math.max(0, Math.floor(minutes));
  store.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function shouldSyncTimeSpent(): boolean {
  const store = readStore();
  return store.minutes > store.lastSyncedMinutes;
}

let started = false;
let tickTimer: number | null = null;
let syncTimer: number | null = null;
let lastVisibleAt: number | null = null;
let onSync: (() => void) | null = null;

function flushVisibleElapsed(): void {
  if (lastVisibleAt == null) return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    lastVisibleAt = null;
    return;
  }
  const now = Date.now();
  const delta = Math.max(0, now - lastVisibleAt);
  lastVisibleAt = now;
  if (delta <= 0) return;

  const store = readStore();
  const totalMs = store.leftoverMs + delta;
  const addMinutes = Math.floor(totalMs / 60_000);
  store.leftoverMs = totalMs % 60_000;
  if (addMinutes > 0) store.minutes += addMinutes;
  store.updatedAt = new Date().toISOString();
  writeStore(store);
}

function onVisibility(): void {
  if (document.visibilityState === "visible") {
    lastVisibleAt = Date.now();
  } else {
    flushVisibleElapsed();
    lastVisibleAt = null;
  }
}

/**
 * Démarre le compteur foreground. `syncFn` appelé périodiquement si des minutes
 * non synchronisées existent (ex. syncUserProfileToNotion).
 */
export function startAppUsageTracking(syncFn?: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  onSync = syncFn ?? null;
  if (started) return () => undefined;
  started = true;

  if (document.visibilityState === "visible") {
    lastVisibleAt = Date.now();
  }
  document.addEventListener("visibilitychange", onVisibility);

  tickTimer = window.setInterval(() => {
    flushVisibleElapsed();
  }, TICK_MS);

  syncTimer = window.setInterval(() => {
    flushVisibleElapsed();
    if (shouldSyncTimeSpent()) onSync?.();
  }, SYNC_EVERY_MS);

  return () => {
    flushVisibleElapsed();
    document.removeEventListener("visibilitychange", onVisibility);
    if (tickTimer != null) window.clearInterval(tickTimer);
    if (syncTimer != null) window.clearInterval(syncTimer);
    tickTimer = null;
    syncTimer = null;
    started = false;
    onSync = null;
    lastVisibleAt = null;
  };
}
