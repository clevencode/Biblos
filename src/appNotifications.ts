/** Notifications in-app — feed pour informer l’utilisateur de ce qui se passe. */

import { todayKey } from "./calendar";
import {
  isNotificationKindEnabled,
  loadNotificationPrefs,
} from "./notificationPrefs";
import {
  isPlanComplete,
  loadPlanProgress,
  progressCounts,
} from "./planProgress";
import type { ReadingPlan } from "./types";
import { getVerseOfDay } from "./verseOfDay";

const STORE_KEY = "biblos-app-notifications-v1";
const MAX_ITEMS = 80;

export type AppNotificationKind = "info" | "plan" | "verse" | "system";

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  /** Empêche les doublons (ex. verset du jour). */
  dedupeKey?: string;
};

type Store = { items: AppNotification[] };

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return { items: parsed.items };
  } catch {
    return { items: [] };
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

export function listAppNotifications(limit = 40): AppNotification[] {
  const prefs = loadNotificationPrefs();
  return readStore()
    .items.filter((item) => isNotificationKindEnabled(item.kind, prefs))
    .slice(0, Math.max(1, limit));
}

export function countUnreadAppNotifications(): number {
  const prefs = loadNotificationPrefs();
  return readStore().items.filter(
    (item) => !item.read && isNotificationKindEnabled(item.kind, prefs),
  ).length;
}

export function pushAppNotification(input: {
  kind: AppNotificationKind;
  title: string;
  body: string;
  dedupeKey?: string;
}): AppNotification {
  const store = readStore();
  const dedupeKey = input.dedupeKey?.trim() || undefined;
  if (dedupeKey) {
    const existing = store.items.find((item) => item.dedupeKey === dedupeKey);
    if (existing) {
      const next: AppNotification = {
        ...existing,
        title: input.title,
        body: input.body,
        kind: input.kind,
      };
      store.items = store.items.map((item) =>
        item.id === existing.id ? next : item,
      );
      writeStore(store);
      return next;
    }
  }
  const item: AppNotification = {
    id: newId(),
    kind: input.kind,
    title: input.title.trim(),
    body: input.body.trim(),
    at: new Date().toISOString(),
    read: false,
    ...(dedupeKey ? { dedupeKey } : {}),
  };
  store.items = [item, ...store.items].slice(0, MAX_ITEMS);
  writeStore(store);
  return item;
}

export function markAppNotificationRead(id: string): void {
  const store = readStore();
  let changed = false;
  store.items = store.items.map((item) => {
    if (item.id !== id || item.read) return item;
    changed = true;
    return { ...item, read: true };
  });
  if (changed) writeStore(store);
}

export function markAllAppNotificationsRead(): void {
  const store = readStore();
  let changed = false;
  store.items = store.items.map((item) => {
    if (item.read) return item;
    changed = true;
    return { ...item, read: true };
  });
  if (changed) writeStore(store);
}

function planTitle(plan: ReadingPlan): string {
  const theme = plan.theme?.trim() ?? "";
  const nome = plan.nome?.trim() ?? "";
  const generic = (value: string) => !value || /^plan$/i.test(value);
  if (!generic(theme)) return theme;
  if (!generic(nome)) return nome;
  return theme || nome || "Plan";
}

/**
 * Met à jour le fil avec le contexte actuel (verset du jour, plans en cours).
 * Respecte les préférences de types activés.
 */
export function syncContextualNotifications(plans: ReadingPlan[]): void {
  const prefs = loadNotificationPrefs();
  const day = todayKey();

  if (prefs.verseOfDay) {
    const verse = getVerseOfDay(day);
    pushAppNotification({
      kind: "verse",
      title: "Verset du jour",
      body: `${verse.reference} — ouvre-le depuis l’Accueil pour le lire.`,
      dedupeKey: `verse-day:${day}`,
    });
  }

  if (prefs.planReminder) {
    let hasActive = false;
    for (const plan of plans) {
      const progress = loadPlanProgress(plan.id);
      if (!progress || isPlanComplete(plan, progress)) continue;
      const { done, total } = progressCounts(plan, progress);
      if (!total) continue;
      hasActive = true;
      const jour = Math.min(done + 1, total);
      pushAppNotification({
        kind: "plan",
        title: planTitle(plan),
        body:
          done === 0
            ? `Prêt à commencer · Jour 1 sur ${total}`
            : `Continue au jour ${jour} · ${done}/${total} jours lus`,
        dedupeKey: `plan-progress:${plan.id}:${day}`,
      });
    }

    if (!hasActive && plans.length) {
      pushAppNotification({
        kind: "plan",
        title: "Choisis un plan",
        body: "Parcours l’onglet Plan pour démarrer une lecture guidée.",
        dedupeKey: `pick-plan:${day}`,
      });
    }
  }

  if (prefs.appInfo) {
    pushAppNotification({
      kind: "system",
      title: "Bienvenue sur Biblos",
      body: "Ici tu suis tes lectures, cartes et versets — ce fil te tient informé de ce qui se passe.",
      dedupeKey: "welcome-biblos",
    });
  }
}

export function formatNotificationWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) return "À l’instant";
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}
