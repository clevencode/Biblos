import { useEffect, useId, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  clearBibleReadingHistory,
  formatActivityWhen,
  listBibleReadingHistory,
  removeActivityById,
  type ActivityEvent,
} from "../activityLog";
import {
  readingLabelForItem,
  toReadingHistoryItem,
  type HistorySelectPayload,
} from "../bible/readingHistoryRepository";
import type { ReadingHistoryItem } from "../bible/readingScope";

export type BibleHistorySelect = HistorySelectPayload;

export type BibleHistorySheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: BibleHistorySelect) => void;
  onHistoryChange?: () => void;
};

type HistoryRow = {
  eventId: string;
  at: string;
  item: ReadingHistoryItem;
};

function rowsFromEvents(events: ActivityEvent[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const event of events) {
    const item = toReadingHistoryItem(event);
    if (!item) continue;
    rows.push({ eventId: event.id, at: event.at, item });
  }
  return rows;
}

function toSelect(item: ReadingHistoryItem): BibleHistorySelect {
  return {
    versionId: item.versionId,
    bookId: item.usfm,
    chapterId: String(item.chapter),
    verse: item.verse ?? null,
  };
}

export function BibleHistorySheet({
  open,
  onClose,
  onSelect,
  onHistoryChange,
}: BibleHistorySheetProps) {
  const titleId = useId();
  const [rows, setRows] = useState<HistoryRow[]>([]);

  function refresh() {
    setRows(rowsFromEvents(listBibleReadingHistory(undefined, 40)));
  }

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function deleteOne(id: string) {
    if (!removeActivityById(id)) return;
    refresh();
    onHistoryChange?.();
  }

  function clearAll() {
    if (rows.length === 0) return;
    const ok = window.confirm("Effacer tout l’historique de lecture ?");
    if (!ok) return;
    clearBibleReadingHistory();
    refresh();
    onHistoryChange?.();
  }

  if (!open) return null;

  return (
    <div
      className="bible-yv-history-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="bible-yv-history-panel-head">
        <p id={titleId} className="bible-yv-history-panel-title">
          Historique
        </p>
        <div className="bible-yv-history-panel-actions">
          {rows.length > 0 ? (
            <button
              type="button"
              className="bible-yv-history-panel-icon-btn"
              onClick={clearAll}
              aria-label="Effacer tout l’historique"
              title="Effacer tout"
            >
              <YvIcon name="delete" className="bible-yv-history-panel-icon" />
            </button>
          ) : null}
          <button
            type="button"
            className="bible-yv-history-panel-icon-btn"
            onClick={onClose}
            aria-label="Fermer l’historique"
          >
            <YvIcon name="close" className="bible-yv-history-panel-icon" />
          </button>
        </div>
      </header>

      <div className="bible-yv-history-panel-meta" aria-live="polite">
        {rows.length === 0 ? (
          <span>Chapitres ouverts récemment</span>
        ) : (
          <span>
            {rows.length} lecture{rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <ul className="bible-yv-history-panel-list" aria-label="Historique de lecture">
        {rows.length === 0 ? (
          <li className="bible-yv-history-panel-empty">
            Aucune lecture enregistrée pour l’instant.
          </li>
        ) : (
          rows.map(({ eventId, at, item }) => {
            const label = readingLabelForItem(item);
            return (
              <li key={eventId} className="bible-history-row">
                <button
                  type="button"
                  className="bible-yv-history-panel-item"
                  onClick={() => onSelect(toSelect(item))}
                >
                  <span className="bible-yv-history-panel-ref">
                    <span
                      className="bible-history-version-badge"
                      data-version={item.versionId}
                    >
                      {item.versionBadge}
                    </span>
                    {label}
                  </span>
                  <span className="bible-yv-history-panel-when">
                    {formatActivityWhen(at)}
                  </span>
                </button>
                <button
                  type="button"
                  className="bible-history-delete"
                  aria-label={`Supprimer ${label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteOne(eventId);
                  }}
                >
                  <YvIcon name="delete" className="bible-history-delete-icon" />
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
