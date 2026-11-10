import { useEffect, useId, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  clearBibleReadingHistory,
  formatActivityWhen,
  listBibleReadingHistory,
  removeActivityById,
  type ActivityEvent,
} from "../activityLog";
import type { BibleHistorySelect } from "./BibleHistorySheet";

type BibleHistoryPanelProps = {
  active: boolean;
  onOpenPassage: (ref: BibleHistorySelect) => void;
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

export function BibleHistoryPanel({
  active,
  onOpenPassage,
  onHistoryChange,
}: BibleHistoryPanelProps) {
  const titleId = useId();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  function refresh() {
    setEvents(listBibleReadingHistory(undefined, 40));
  }

  useEffect(() => {
    if (!active) return;
    refresh();
  }, [active]);

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

  return (
    <div
      id="panel-history"
      role="tabpanel"
      aria-labelledby="tab-history"
      hidden={!active}
      className="pane-body bible-shell-panel bible-history-panel"
    >
      <header className="bible-shell-panel-head">
        <h2 id={titleId} className="bible-shell-panel-title">
          Historique
        </h2>
        {events.length > 0 ? (
          <button
            type="button"
            className="bible-shell-panel-action"
            onClick={clearAll}
            aria-label="Effacer tout l’historique"
          >
            <YvIcon name="delete" />
            <span>Effacer tout</span>
          </button>
        ) : null}
      </header>
      <p className="bible-shell-panel-lead" aria-live="polite">
        {events.length === 0
          ? "Chapitres ouverts récemment"
          : `${events.length} lecture${events.length === 1 ? "" : "s"}`}
      </p>
      <ul className="bible-shell-panel-list" aria-label="Historique de lecture">
        {events.length === 0 ? (
          <li className="bible-shell-panel-empty">Aucune lecture enregistrée pour l’instant.</li>
        ) : (
          events.map((event) => {
            const ref = parseReadingEvent(event);
            if (!ref) return null;
            return (
              <li key={event.id} className="bible-history-row">
                <button
                  type="button"
                  className="bible-search-sheet-item"
                  onClick={() => onOpenPassage(ref)}
                >
                  <span className="bible-search-sheet-ref">{readingLabel(event, ref)}</span>
                  <span className="bible-search-sheet-snippet">{formatActivityWhen(event.at)}</span>
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
