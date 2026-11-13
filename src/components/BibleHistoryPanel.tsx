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
} from "../bible/readingHistoryRepository";
import type { ReadingHistoryItem } from "../bible/readingScope";
import type { BibleHistorySelect } from "./BibleHistorySheet";
import { useUiLocale } from "../i18n/UiLocaleContext";

type BibleHistoryPanelProps = {
  active: boolean;
  onOpenPassage: (ref: BibleHistorySelect) => void;
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

export function BibleHistoryPanel({
  active,
  onOpenPassage,
  onHistoryChange,
}: BibleHistoryPanelProps) {
  const { t, dateLocale } = useUiLocale();
  const titleId = useId();
  const [rows, setRows] = useState<HistoryRow[]>([]);

  function refresh() {
    setRows(rowsFromEvents(listBibleReadingHistory(undefined, 40)));
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
    if (rows.length === 0) return;
    const ok = window.confirm(t("history.clearAllConfirm"));
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
          {t("history.title")}
        </h2>
        {rows.length > 0 ? (
          <button
            type="button"
            className="bible-shell-panel-action"
            onClick={clearAll}
            aria-label={t("history.clearAll")}
          >
            <YvIcon name="delete" />
            <span>{t("history.clearAll")}</span>
          </button>
        ) : null}
      </header>
      <p className="bible-shell-panel-lead" aria-live="polite">
        {rows.length === 0
          ? t("history.recent")
          : rows.length === 1
            ? t("history.countOne", { n: rows.length })
            : t("history.count", { n: rows.length })}
      </p>
      <ul className="bible-shell-panel-list" aria-label={t("history.title")}>
        {rows.length === 0 ? (
          <li className="bible-shell-panel-empty">{t("history.empty")}</li>
        ) : (
          rows.map(({ eventId, at, item }) => {
            const label = readingLabelForItem(item);
            return (
              <li key={eventId} className="bible-history-row">
                <button
                  type="button"
                  className="bible-search-sheet-item"
                  onClick={() => onOpenPassage(toSelect(item))}
                >
                  <span className="bible-search-sheet-ref">
                    <span
                      className="bible-history-version-badge"
                      data-version={item.versionId}
                    >
                      {item.versionBadge}
                    </span>
                    {label}
                  </span>
                  <span className="bible-search-sheet-snippet">
                    {formatActivityWhen(at, dateLocale)}
                  </span>
                </button>
                <button
                  type="button"
                  className="bible-history-delete"
                  aria-label={`${t("history.delete")} ${label}`}
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
