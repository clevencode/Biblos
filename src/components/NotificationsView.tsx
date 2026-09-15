import { ChevronRight, Trash2 } from "lucide-react";
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

type NotifBlock =
  | { type: "p"; text: string }
  | { type: "feature"; label: string; text: string }
  | { type: "tip"; text: string };

function previewBody(body: string, max = 96): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

/** Structure le corps : paragraphes, lignes « Label — … », astuce. */
function parseNotificationBody(body: string): NotifBlock[] {
  const lines = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: NotifBlock[] = [];
  const featureRe = /^(.+?)\s+[—–-]\s+(.+)$/u;

  for (const line of lines) {
    if (/^astuce\b/i.test(line)) {
      blocks.push({
        type: "tip",
        text: line.replace(/^astuce\s*:\s*/i, "").trim() || line,
      });
      continue;
    }
    const match = line.match(featureRe);
    if (match) {
      blocks.push({
        type: "feature",
        label: match[1]!.trim(),
        text: match[2]!.trim(),
      });
      continue;
    }
    blocks.push({ type: "p", text: line });
  }
  return blocks;
}

function NotificationBody({ body }: { body: string }) {
  const blocks = parseNotificationBody(body);
  if (!blocks.length) {
    return <p className="notif-detail-p muted">—</p>;
  }

  const features = blocks.filter(
    (block): block is Extract<NotifBlock, { type: "feature" }> =>
      block.type === "feature",
  );
  const rest = blocks.filter((block) => block.type !== "feature");

  return (
    <div className="notif-detail-body">
      {rest
        .filter((block) => block.type === "p")
        .map((block, index) => (
          <p key={`p-${index}`} className="notif-detail-p">
            {block.text}
          </p>
        ))}

      {features.length ? (
        <ul className="notif-feature-list">
          {features.map((block) => (
            <li key={block.label} className="notif-feature">
              <span className="notif-feature-label">{block.label}</span>
              <span className="notif-feature-copy">{block.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {rest
        .filter((block): block is Extract<NotifBlock, { type: "tip" }> => block.type === "tip")
        .map((block, index) => (
          <aside key={`tip-${index}`} className="notif-tip">
            <span className="notif-tip-label">Astuce</span>
            <p className="notif-tip-copy">{block.text}</p>
          </aside>
        ))}
    </div>
  );
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
          <NotificationBody body={selected.body || ""} />
        </article>

        <div className="notif-detail-actions">
          <button
            type="button"
            className="notif-delete-btn"
            onClick={onDeleteSelected}
          >
            <Trash2 className="notif-delete-icon" aria-hidden />
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
                <ChevronRight className="notif-item-chevron" aria-hidden />
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
