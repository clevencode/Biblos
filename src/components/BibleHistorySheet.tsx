import { useEffect, useId, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  clearBibleReadingHistory,
  formatActivityWhen,
  listBibleReadingHistory,
  removeActivityById,
  type ActivityEvent,
} from "../activityLog";

export type BibleHistorySelect = {
  bookId: string;
  chapterId: string;
  verse: number | null;
};

export type BibleHistorySheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: BibleHistorySelect) => void;
  onHistoryChange?: () => void;
};

function parseReadingEvent(event: ActivityEvent): BibleHistorySelect | null {
  const bookId = String(event.meta?.bookId || "").trim().toUpperCase();
  const chapterId = String(event.meta?.chapterId || "").trim();
  if (!bookId || !chapterId) return null;
  const verseRaw = event.meta?.verse;
  const verse =
    typeof verseRaw === "number" && Number.isFinite(verseRaw) ? verseRaw : null;
  return { bookId, chapterId, verse };
}

function readingLabel(event: ActivityEvent, ref: BibleHistorySelect): string {
  const fromMeta = String(event.meta?.label || "").trim();
  if (fromMeta) return fromMeta;
  return ref.verse != null
    ? `${ref.bookId} ${ref.chapterId}.${ref.verse}`
    : `${ref.bookId} ${ref.chapterId}`;
}

export function BibleHistorySheet({
  open,
  onClose,
  onSelect,
  onHistoryChange,
}: BibleHistorySheetProps) {
  const titleId = useId();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  function refresh() {
    setEvents(listBibleReadingHistory(undefined, 40));
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
    if (events.length === 0) return;
    const ok = window.confirm("Effacer tout l’historique de lecture ?");
    if (!ok) return;
    clearBibleReadingHistory();
    refresh();
    onHistoryChange?.();
  }

  if (!open) return null;

  return (
    <div
      className="bible-search-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="bible-search-sheet-head bible-history-sheet-head">
        <span className="bible-search-sheet-spacer" aria-hidden />
        <p id={titleId} className="bible-search-sheet-title">
          Historique
        </p>
        <div className="bible-history-sheet-actions">
          {events.length > 0 ? (
            <button
              type="button"
              className="bible-search-sheet-clear-all"
              onClick={clearAll}
              aria-label="Effacer tout l’historique"
              title="Effacer tout"
            >
              <YvIcon name="delete" className="bible-search-sheet-clear-all-icon" />
            </button>
          ) : null}
          <button
            type="button"
            className="bible-search-sheet-exit"
            onClick={onClose}
            aria-label="Fermer l’historique"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3.2 3.2l7.6 7.6M10.8 3.2l-7.6 7.6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="bible-search-sheet-meta" aria-live="polite">
        {events.length === 0 ? (
          <span>Chapitres ouverts récemment</span>
        ) : (
          <span>
            {events.length} lecture{events.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <ul className="bible-search-sheet-list" aria-label="Historique de lecture">
        {events.length === 0 ? (
          <li className="bible-search-sheet-empty">
            Aucune lecture enregistrée pour l’instant.
          </li>
        ) : (
          events.map((event) => {
            const ref = parseReadingEvent(event);
            if (!ref) return null;
            return (
              <li key={event.id} className="bible-history-row">
                <button
                  type="button"
                  className="bible-search-sheet-item"
                  onClick={() => onSelect(ref)}
                >
                  <span className="bible-search-sheet-ref">
                    {readingLabel(event, ref)}
                  </span>
                  <span className="bible-search-sheet-snippet">
                    {formatActivityWhen(event.at)}
                  </span>
                </button>
                <button
                  type="button"
                  className="bible-history-delete"
                  aria-label={`Supprimer ${readingLabel(event, ref)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteOne(event.id);
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
