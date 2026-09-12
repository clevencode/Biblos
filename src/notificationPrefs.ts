/** Préférences des types de notifications in-app. */

const PREFS_KEY = "biblos-notification-prefs-v1";

export type NotificationPrefs = {
  /** Verset du jour */
  verseOfDay: boolean;
  /** Rappel de plan de lecture */
  planReminder: boolean;
  /** Infos / activité de l’app */
  appInfo: boolean;
};

const DEFAULT_OFF: NotificationPrefs = {
  verseOfDay: false,
  planReminder: false,
  appInfo: false,
};

const DEFAULT_ON: NotificationPrefs = {
  verseOfDay: true,
  planReminder: true,
  appInfo: true,
};

function parsePrefs(raw: unknown): NotificationPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  return {
    verseOfDay: Boolean(data.verseOfDay),
    planReminder: Boolean(data.planReminder),
    appInfo: Boolean(data.appInfo),
  };
}

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_OFF };
    const parsed = parsePrefs(JSON.parse(raw) as unknown);
    return parsed ?? { ...DEFAULT_OFF };
  } catch {
    return { ...DEFAULT_OFF };
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): NotificationPrefs {
  const next: NotificationPrefs = {
    verseOfDay: Boolean(prefs.verseOfDay),
    planReminder: Boolean(prefs.planReminder),
    appInfo: Boolean(prefs.appInfo),
  };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

/** Activé à l’acceptation des termes à l’entrée de l’app. */
export function enableDefaultNotificationPrefs(): NotificationPrefs {
  return saveNotificationPrefs({ ...DEFAULT_ON });
}

/**
 * Si les termes sont déjà acceptés mais aucune préférence n’existe encore,
 * active les 3 types (migration / sessions déjà onboardées).
 */
export function ensureNotificationPrefsIfPrivacyAccepted(
  privacyAccepted: boolean,
): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw != null) return loadNotificationPrefs();
  } catch {
    /* ignore */
  }
  if (privacyAccepted) return enableDefaultNotificationPrefs();
  return { ...DEFAULT_OFF };
}

export function patchNotificationPrefs(
  patch: Partial<NotificationPrefs>,
): NotificationPrefs {
  return saveNotificationPrefs({
    ...loadNotificationPrefs(),
    ...patch,
  });
}

export function isNotificationKindEnabled(
  kind: "verse" | "plan" | "info" | "system",
  prefs: NotificationPrefs = loadNotificationPrefs(),
): boolean {
  switch (kind) {
    case "verse":
      return prefs.verseOfDay;
    case "plan":
      return prefs.planReminder;
    case "info":
    case "system":
      return prefs.appInfo;
    default:
      return false;
  }
}
