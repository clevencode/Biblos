import { ChevronRightIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import {
  formatNotificationWhen,
  listAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
  notificationDisplayTitle,
  removeAppNotification,
  syncContextualNotifications,
  type AppNotification,
} from "../appNotifications";
import type { ReadingPlan } from "../types";

type NotificationsViewProps = {
  plans: ReadingPlan[];
  onBack: () => void;
};

function previewBody(body: string, max = 96): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function NotificationsView({ plans, onBack }: NotificationsViewProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    syncContextualNotifications(plans);
    await new Promise((r) => window.setTimeout(r, 400));
    setItems(listAppNotifications(50));
  }

  useEffect(() => {
    void refresh();
  }, [plans]);

  const selected = selectedId
    ? items.find((item) => item.id === selectedId) ?? null
    : null;

  function onOpenItem(item: AppNotification) {
    markAppNotificationRead(item.id);
    setItems(listAppNotifications(50));
    setSelectedId(item.id);
  }

  function onMarkAll() {
    markAllAppNotificationsRead();
    setItems(listAppNotifications(50));
  }

  function onDeleteSelected() {
    if (!selected) return;
    const ok = window.confirm("Supprimer cette notification ?");
    if (!ok) return;
    removeAppNotification(selected.id);
    setSelectedId(null);
    setItems(listAppNotifications(50));
  }

  const unread = items.filter((item) => !item.read).length;

  if (selected) {
    return (
      <div className="notif-view notif-detail">
        <header className="notif-head">
          <button
            type="button"
            className="flash-list-back"
            onClick={() => setSelectedId(null)}
            aria-label="Retour à la liste"
          >
            ←
          </button>
          <div className="notif-head-copy">
            <h1 className="notif-title type-title">
              {notificationDisplayTitle(selected)}
            </h1>
            <p className="notif-detail-when muted">
              {formatNotificationWhen(selected.at)}
            </p>
          </div>
        </header>

        <article className="notif-detail-card">
          <p className="notif-detail-body">{selected.body || "—"}</p>
        </article>

        <div className="notif-detail-actions">
          <button
            type="button"
            className="notif-delete-btn"
            onClick={onDeleteSelected}
          >
            <TrashIcon className="notif-delete-icon" aria-hidden />
            Supprimer
          </button>
        </div>
      </div>
    );
  }

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
        </div>
      </header>

      <div className="notif-list-head">
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
                <span className="notif-item-main">
                  <span className="notif-item-top">
                    <span className="notif-item-title">
                      {notificationDisplayTitle(item)}
                    </span>
                    <span className="notif-item-when muted">
                      {formatNotificationWhen(item.at)}
                    </span>
                  </span>
                  {item.body.trim() ? (
                    <span className="notif-item-body muted">
                      {previewBody(item.body)}
                    </span>
                  ) : null}
                </span>
                <ChevronRightIcon className="notif-item-chevron" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notif-empty muted">
          Aucune notification pour le moment.
        </p>
      )}
    </div>
  );
}
