/** Notifications in-app — feed pour informer l’utilisateur de ce qui se passe. */

import { apiUrl } from "./apiBase";
import { todayKey } from "./calendar";
import { loadNotificationPrefs } from "./notificationPrefs";
import {
  isPlanComplete,
  loadPlanProgress,
  progressCounts,
} from "./planProgress";
import type { ReadingPlan } from "./types";
import { getVerseOfDay } from "./verseOfDay";
import { buildDailyReadingReminder } from "./readingReminder";
import { scheduleDeviceDailyAlerts } from "./readingReminderNotify";

const STORE_KEY = "biblos-app-notifications-v1";
const DISMISSED_KEY = "biblos-app-notifications-dismissed-v1";
const MAX_ITEMS = 80;

export type AppNotificationKind = "info" | "plan" | "verse" | "system";

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  /** Libellé Notion (Annonce, Mise à jour, …) — pour l’affichage du type. */
  kindLabel?: string;
  /** Empêche les doublons (ex. verset du jour). */
  dedupeKey?: string;
};

const GENERIC_TITLE_RE =
  /^(info|information|notification|mise\s*à\s*jour|annonces?|actualité|actualite)$/iu;

/** Libellé de type jamais générique « Info ». */
export function notificationKindDisplayLabel(kindLabel?: string, kind?: AppNotificationKind): string {
  const raw = String(kindLabel || "").trim();
  const key = raw.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (key.includes("annonce")) return "Annonce";
  if (key.includes("mise")) return "Mise à jour";
  if (key === "system" || kind === "system") return "Mise à jour";
  if (key === "plan" || kind === "plan") return "Plan";
  if (key === "verse" || kind === "verse") return "Verset";
  if (key === "info" || key === "information" || !raw) return "Actualité";
  return raw;
}

/** Titre affiché : type concret, ou Name Notion s’il n’est pas générique. */
export function notificationDisplayTitle(item: AppNotification): string {
  const name = String(item.title || "").trim();
  const typeLabel = notificationKindDisplayLabel(item.kindLabel, item.kind);
  if (name && !GENERIC_TITLE_RE.test(name)) return name;
  return typeLabel;
}

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

function readDismissedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeDismissedKeys(keys: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys].slice(0, 200)));
  } catch {
    /* private mode */
  }
}

export function getAppNotificationById(id: string): AppNotification | null {
  return readStore().items.find((item) => item.id === id) ?? null;
}

export function removeAppNotification(id: string): boolean {
  const store = readStore();
  const target = store.items.find((item) => item.id === id);
  if (!target) return false;
  store.items = store.items.filter((item) => item.id !== id);
  writeStore(store);
  const dismissed = readDismissedKeys();
  dismissed.add(`id:${id}`);
  if (target.dedupeKey) dismissed.add(target.dedupeKey);
  writeDismissedKeys(dismissed);
  return true;
}

export function listAppNotifications(limit = 40): AppNotification[] {
  // Fil in-app = uniquement infos / mises à jour de l’app.
  return readStore()
    .items.filter((item) => item.kind === "info" || item.kind === "system")
    .slice(0, Math.max(1, limit));
}

export function countUnreadAppNotifications(): number {
  return readStore().items.filter(
    (item) =>
      !item.read && (item.kind === "info" || item.kind === "system"),
  ).length;
}

export function pushAppNotification(input: {
  kind: AppNotificationKind;
  title: string;
  body: string;
  kindLabel?: string;
  dedupeKey?: string;
}): AppNotification | null {
  const dedupeKey = input.dedupeKey?.trim() || undefined;
  if (dedupeKey && readDismissedKeys().has(dedupeKey)) {
    return null;
  }
  const kindLabel = input.kindLabel?.trim() || undefined;
  const store = readStore();
  if (dedupeKey) {
    const existing = store.items.find((item) => item.dedupeKey === dedupeKey);
    if (existing) {
      const next: AppNotification = {
        ...existing,
        title: input.title,
        body: input.body,
        kind: input.kind,
        ...(kindLabel ? { kindLabel } : {}),
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
    ...(kindLabel ? { kindLabel } : {}),
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
 * Fil in-app = mises à jour de l’app (Notion Notifications).
 * Verset du jour + rappel de plan → alertes appareil (hors fil).
 */
export function syncContextualNotifications(plans: ReadingPlan[]): void {
  ensureWelcomeNotification();
  void pullRemoteAppNotifications();
  void syncDeviceAlertsFromPrefs(plans);
}

const WELCOME_DEDUPE = "welcome:v1";

/** Message d’accueil (une fois) : but de l’app + parcours des onglets. */
export function ensureWelcomeNotification(): void {
  pushAppNotification({
    kind: "info",
    kindLabel: "Bienvenue",
    title: "Bienvenue sur Biblos",
    dedupeKey: WELCOME_DEDUPE,
    body: [
      "Biblos t’aide à lire la Bible chaque jour, suivre un plan et mémoriser les versets qui comptent.",
      "",
      "Accueil — Vois tes plans en cours, le verset du jour et ouvre tes notifications.",
      "",
      "Plan — Choisis un plan de lecture, filtre par progression (attente, en cours, terminé) et avance jour après jour.",
      "",
      "Bible — Lis le texte, cherche un passage, écoute l’audio et marque les versets à garder.",
      "",
      "Cartes — Révise tes flashcards (nouveau, en révision, terminé) pour ancrer ce que tu as lu.",
      "",
      "Profil — Règle le thème, les alertes, retrouve ce que tu as gardé, et consulte l’aide.",
      "",
      "Astuce : ouvre Accueil pour le verset du jour, choisis un plan dans Plan, lis le chapitre du jour dans Bible (marque un verset), puis révise-le dans Cartes.",
    ].join("\n"),
  });
}

/** Importe les messages publiés depuis Notion dans le fil local. */
export async function pullRemoteAppNotifications(): Promise<void> {
  try {
    const res = await fetch(apiUrl("/api/notifications?limit=40"));
    const data = (await res.json()) as {
      ok?: boolean;
      items?: Array<{
        id: string;
        title: string;
        body: string;
        kind?: string;
        at?: string;
      }>;
    };
    if (!data?.ok || !Array.isArray(data.items)) return;
    for (const item of data.items) {
      const id = String(item.id || "").trim();
      if (!id) continue;
      const kindLabel = String(
        (item as { kindLabel?: string }).kindLabel || item.kind || "",
      ).trim();
      const mappedKind: AppNotificationKind =
        /mise|update|annonce|system/i.test(kindLabel) ? "system" : "info";
      pushAppNotification({
        kind: mappedKind,
        title: String(item.title || "").trim() || notificationKindDisplayLabel(kindLabel),
        body: String(item.body || "").trim(),
        kindLabel: kindLabel || notificationKindDisplayLabel(kindLabel, mappedKind),
        dedupeKey: `notion:${id}`,
      });
    }
  } catch {
    /* offline / API indisponible */
  }
}

/** Prépare les alertes système selon les préférences (verset / plan). */
export async function syncDeviceAlertsFromPrefs(
  plans: ReadingPlan[],
): Promise<void> {
  const prefs = loadNotificationPrefs();
  const day = todayKey();
  const verse = prefs.verseOfDay ? getVerseOfDay(day) : null;

  let planAlert: { title: string; body: string } | null = null;
  if (prefs.planReminder) {
    for (const plan of plans) {
      const progress = loadPlanProgress(plan.id);
      if (!progress || isPlanComplete(plan, progress)) continue;
      const reminder = buildDailyReadingReminder(plan, progress);
      if (!reminder || reminder.complete) continue;
      planAlert = { title: reminder.title, body: reminder.body };
      break;
    }
    if (!planAlert && plans.length) {
      const { done, total } = progressCounts(plans[0]!, loadPlanProgress(plans[0]!.id));
      planAlert = {
        title: planTitle(plans[0]!),
        body:
          total > 0
            ? `Continue ta lecture · ${done}/${total} jours`
            : "Ouvre l’onglet Plan pour avancer.",
      };
    }
  }

  await scheduleDeviceDailyAlerts({
    verse: verse
      ? {
          title: "Verset du jour",
          body: `${verse.reference} — ${verse.fallback.slice(0, 120)}${verse.fallback.length > 120 ? "…" : ""}`,
        }
      : null,
    plan: planAlert,
  });
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
