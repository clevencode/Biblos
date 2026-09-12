import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { DailyReadingReminder } from "./readingReminder";

export type ReminderScheduleResult = {
  ok: boolean;
  mode: "native" | "web" | "none";
  at?: string;
  error?: string;
};

const TEST_NOTIFICATION_ID = 71001;
const CHANNEL_ID = "biblos-reading";

async function ensureNativeChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Lecture biblique",
      description: "Rappels de passages du plan de lecture",
      importance: 5,
      visibility: 1,
    });
  } catch {
    /* canal déjà créé / API < 26 */
  }
}

async function ensureNativePermission(): Promise<boolean> {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  const next = await LocalNotifications.requestPermissions();
  return next.display === "granted";
}

export type NotificationPermissionState = "granted" | "denied" | "prompt" | "unsupported";

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "granted") return "granted";
      if (current.display === "denied") return "denied";
      return "prompt";
    } catch {
      return "unsupported";
    }
  }
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "prompt";
}

/** Demande l’autorisation des notifications (natif ou navigateur). */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNativeChannel();
      const allowed = await ensureNativePermission();
      return allowed ? "granted" : "denied";
    } catch {
      return "unsupported";
    }
  }
  if (typeof Notification === "undefined") return "unsupported";
  try {
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    const next = await Notification.requestPermission();
    if (next === "granted") return "granted";
    if (next === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/**
 * Agenda um lembrete de teste (default: daqui a 15s) com o conteúdo do dia.
 * Native = Capacitor Local Notifications; browser = Notification API.
 */
export async function scheduleReadingReminderTest(
  reminder: DailyReadingReminder,
  delaySeconds = 15,
): Promise<ReminderScheduleResult> {
  const at = new Date(Date.now() + Math.max(3, delaySeconds) * 1000);

  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNativeChannel();
      const allowed = await ensureNativePermission();
      if (!allowed) {
        return { ok: false, mode: "native", error: "Permission notifications refusée" };
      }
      await LocalNotifications.cancel({ notifications: [{ id: TEST_NOTIFICATION_ID }] });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: TEST_NOTIFICATION_ID,
            title: reminder.title,
            body: reminder.body,
            schedule: { at, allowWhileIdle: true },
            channelId: CHANNEL_ID,
            extra: {
              kind: "reading-reminder-test",
              planId: reminder.planId,
              jour: reminder.jour,
            },
          },
        ],
      });
      return { ok: true, mode: "native", at: at.toISOString() };
    } catch (error) {
      return {
        ok: false,
        mode: "native",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (typeof Notification === "undefined") {
    return { ok: false, mode: "none", error: "Notifications indisponibles dans ce navigateur" };
  }

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return { ok: false, mode: "web", error: "Permission notifications refusée" };
    }
    window.setTimeout(() => {
      new Notification(reminder.title, {
        body: reminder.body,
        tag: "biblos-reading-test",
      });
    }, Math.max(3, delaySeconds) * 1000);
    return { ok: true, mode: "web", at: at.toISOString() };
  } catch (error) {
    return {
      ok: false,
      mode: "web",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
