import { useEffect, useId, useState } from "react";
import {
  clearBibleReadingHistory,
  formatActivityWhen,
  listBibleReadingHistory,
  type ActivityEvent,
} from "../activityLog";
import {
  readingLabelForItem,
  toReadingHistoryItem,
  type HistorySelectPayload,
} from "../bible/readingHistoryRepository";
import type { ReadingHistoryItem } from "../bible/readingScope";
import {
  listAllVerseMarks,
  subscribeVerseMarksRevision,
  type SavedVerseMark,
} from "../verseMarks";
import { useUiLocale } from "../i18n/UiLocaleContext";

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

function markToSelect(mark: SavedVerseMark): BibleHistorySelect {
  return {
    versionId: "s21",
    bookId: mark.bookId,
    chapterId: mark.chapterId,
    verse: mark.verse,
  };
}

export function BibleHistorySheet({
  open,
  onClose,
  onSelect,
  onHistoryChange,
}: BibleHistorySheetProps) {
  const { t, dateLocale } = useUiLocale();
  const titleId = useId();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [marks, setMarks] = useState<SavedVerseMark[]>([]);

  function refresh() {
    setRows(rowsFromEvents(listBibleReadingHistory(undefined, 40)));
    setMarks(listAllVerseMarks());
  }

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return subscribeVerseMarksRevision(() => {
      setMarks(listAllVerseMarks());
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function clearAll() {
    if (rows.length === 0) return;
    const ok = window.confirm(t("history.clearAllConfirm"));
    if (!ok) return;
    clearBibleReadingHistory();
    refresh();
    onHistoryChange?.();
  }

  if (!open) return null;

  return (
    <div
      className="bible-yv-history-panel top-floating-sheet is-open"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <header className="bible-yv-history-panel-head">
        <p id={titleId} className="bible-yv-history-panel-title">
          {t("history.title")}
        </p>
        <div className="bible-yv-history-panel-actions">
          {rows.length > 0 ? (
            <button
              type="button"
              className="bible-yv-history-panel-clear"
              onClick={clearAll}
              aria-label={t("common.clear")}
              title={t("history.clearAll")}
            >
              {t("common.clear")}
            </button>
          ) : null}
        </div>
      </header>

      <div className="bible-yv-history-panel-body">
        <section
          className="bible-yv-history-section"
          aria-labelledby="bible-history-marks-title"
        >
          <div className="bible-yv-history-section-head">
            <p id="bible-history-marks-title" className="bible-yv-history-section-title">
              {t("profile.marks")}
            </p>
            {marks.length > 0 ? (
              <span className="bible-yv-history-section-count">{marks.length}</span>
            ) : null}
          </div>
          {marks.length === 0 ? (
            <p className="bible-yv-history-panel-empty">{t("profile.marksEmpty")}</p>
          ) : (
            <ul
              className="bible-yv-history-panel-list"
              aria-label={t("profile.marks")}
            >
              {marks.map((mark) => (
                <li key={mark.key} className="bible-history-row">
                  <button
                    type="button"
                    className="bible-yv-history-panel-item"
                    onClick={() => onSelect(markToSelect(mark))}
                  >
                    <span className="bible-yv-history-panel-ref">
                      <span
                        className="bible-history-mark-swatch"
                        style={{ background: mark.color }}
                        aria-hidden
                      />
                      {mark.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="bible-yv-history-section"
          aria-labelledby="bible-history-recent-title"
        >
          <div className="bible-yv-history-section-head">
            <p id="bible-history-recent-title" className="bible-yv-history-section-title">
              {t("history.recent")}
            </p>
            <span className="bible-yv-history-section-count" aria-live="polite">
              {rows.length === 0
                ? null
                : rows.length === 1
                  ? t("history.countOne", { n: rows.length })
                  : t("history.count", { n: rows.length })}
            </span>
          </div>

          <ul className="bible-yv-history-panel-list" aria-label={t("history.title")}>
            {rows.length === 0 ? (
              <li className="bible-yv-history-panel-empty">{t("history.empty")}</li>
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
                        {formatActivityWhen(at, dateLocale)}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
