import { BellAlertIcon, BellIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import {
  formatNotificationWhen,
  listAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
  syncContextualNotifications,
  type AppNotification,
} from "../appNotifications";
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "../readingReminderNotify";
import type { ReadingPlan } from "../types";

type NotificationsViewProps = {
  plans: ReadingPlan[];
  onBack: () => void;
};

export function NotificationsView({ plans, onBack }: NotificationsViewProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [perm, setPerm] = useState<NotificationPermissionState>("prompt");
  const [permBusy, setPermBusy] = useState(false);
  const [permHint, setPermHint] = useState<string | null>(null);

  function refresh() {
    syncContextualNotifications(plans);
    setItems(listAppNotifications(50));
  }

  useEffect(() => {
    refresh();
  }, [plans]);

  useEffect(() => {
    let cancelled = false;
    void getNotificationPermissionState().then((state) => {
      if (!cancelled) setPerm(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleDeviceNotifications() {
    if (permBusy) return;
    setPermBusy(true);
    setPermHint(null);
    const next = await requestNotificationPermission();
    setPerm(next);
    setPermBusy(false);
    if (next === "granted") {
      setPermHint("Tu recevras aussi des alertes sur cet appareil.");
    } else if (next === "denied") {
      setPermHint("Autorisation refusée — tu peux l’activer dans les réglages du système.");
    } else if (next === "unsupported") {
      setPermHint("Alertes système indisponibles ici.");
    }
  }

  function onOpenItem(item: AppNotification) {
    markAppNotificationRead(item.id);
    setItems(listAppNotifications(50));
  }

  function onMarkAll() {
    markAllAppNotificationsRead();
    setItems(listAppNotifications(50));
  }

  const unread = items.filter((item) => !item.read).length;
  const deviceOn = perm === "granted";
  const DeviceBell = deviceOn ? BellAlertIcon : BellIcon;

  return (
    <div className="notif-view">
      <header className="notif-head">
        <button
          type="button"
          className="flash-list-back"
          onClick={onBack}
          aria-label="Retour"
        >
          ←
        </button>
        <div className="notif-head-copy">
          <h1 className="notif-title type-title">Notifications</h1>
          <p className="notif-lead muted">
            Pour te tenir informé de ce qui se passe dans Biblos.
          </p>
        </div>
      </header>

      <section className="notif-device" aria-label="Alertes appareil">
        <button
          type="button"
          className={`notif-device-btn${deviceOn ? " is-on" : ""}`}
          disabled={permBusy}
          onClick={() => void toggleDeviceNotifications()}
        >
          <DeviceBell className="notif-device-icon" aria-hidden />
          <span className="notif-device-stack">
            <span className="notif-device-label">
              {deviceOn ? "Alertes appareil activées" : "Activer les alertes appareil"}
            </span>
            <span className="notif-device-meta muted">
              Rappels et infos même hors de l’app
            </span>
          </span>
        </button>
        {permHint ? (
          <p className="notif-device-hint muted" role="status">
            {permHint}
          </p>
        ) : null}
      </section>

      <div className="notif-list-head">
        <h2 className="notif-list-title">Activité</h2>
        {unread > 0 ? (
          <button type="button" className="notif-mark-all" onClick={onMarkAll}>
            Tout marquer lu
          </button>
        ) : null}
      </div>

      {items.length ? (
        <ul className="notif-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`notif-item${item.read ? "" : " is-unread"}`}
                onClick={() => onOpenItem(item)}
              >
                <span className="notif-item-top">
                  <span className="notif-item-title">{item.title}</span>
                  <span className="notif-item-when muted">
                    {formatNotificationWhen(item.at)}
                  </span>
                </span>
                <span className="notif-item-body muted">{item.body}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notif-empty muted">Aucune notification pour le moment.</p>
      )}
    </div>
  );
}
