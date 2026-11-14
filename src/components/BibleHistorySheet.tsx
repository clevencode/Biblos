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
import { offlinePassage } from "../bibleOffline";
import { ht1998Books, ht1998Passage } from "../bible/ht1998";
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

/** HT98: título do livro na língua de origem (ex. Jan, não Jean). */
function historyDisplayLabel(
  item: ReadingHistoryItem,
  htTitles: ReadonlyMap<string, string>,
): string {
  if (item.versionId === "ht98") {
    const title = htTitles.get(item.usfm.toUpperCase())?.trim();
    if (title) {
      return item.verse != null
        ? `${title} ${item.chapter}.${item.verse}`
        : `${title} ${item.chapter}`;
    }
  }
  return readingLabelForItem(item);
}

async function loadHistoryVerseTexts(
  rows: HistoryRow[],
): Promise<Record<string, string>> {
  const byChapter = new Map<
    string,
    { versionId: ReadingHistoryItem["versionId"]; bookId: string; chapter: number; rows: HistoryRow[] }
  >();

  for (const row of rows) {
    const key = `${row.item.versionId}:${row.item.usfm}.${row.item.chapter}`;
    const existing = byChapter.get(key);
    if (existing) existing.rows.push(row);
    else {
      byChapter.set(key, {
        versionId: row.item.versionId,
        bookId: row.item.usfm,
        chapter: row.item.chapter,
        rows: [row],
      });
    }
  }

  const out: Record<string, string> = {};
  await Promise.all(
    [...byChapter.values()].map(async (group) => {
      try {
        const chapterKey = `${group.bookId}.${group.chapter}`;
        const result =
          group.versionId === "ht98"
            ? await ht1998Passage(chapterKey)
            : await offlinePassage(chapterKey);
        if (!result.ok) return;
        const verses = result.passage.verses ?? [];
        const byNumber = new Map(
          verses.map((verse) => [verse.number, String(verse.text || "").trim()]),
        );
        const firstText = verses[0]
          ? String(verses[0].text || "").trim()
          : "";
        for (const row of group.rows) {
          const verse = row.item.verse;
          const text =
            verse != null ? byNumber.get(verse) || firstText : firstText;
          if (text) out[row.eventId] = text;
        }
      } catch {
        /* ignore chapter */
      }
    }),
  );
  return out;
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
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({});
  const [textsBusy, setTextsBusy] = useState(false);
  const [htTitles, setHtTitles] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

  function refresh() {
    setRows(rowsFromEvents(listBibleReadingHistory(undefined, 40)));
  }

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void ht1998Books()
      .then((books) => {
        if (cancelled) return;
        setHtTitles(
          new Map(
            books.map((book) => [
              String(book.id || "").toUpperCase(),
              String(book.title || "").trim(),
            ]),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setHtTitles(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || rows.length === 0) {
      setVerseTexts({});
      setTextsBusy(false);
      return;
    }
    let cancelled = false;
    setTextsBusy(true);
    void loadHistoryVerseTexts(rows).then((map) => {
      if (cancelled) return;
      setVerseTexts(map);
      setTextsBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, rows]);

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
      aria-label={t("history.title")}
    >
      <header className="bible-yv-history-panel-head is-actions-only">
        <span id={titleId} className="sr-only">
          {t("history.title")}
        </span>
        <div className="bible-yv-history-panel-meta" aria-live="polite">
          {rows.length === 0 ? (
            <span>{t("history.recent")}</span>
          ) : (
            <span>
              {rows.length === 1
                ? t("history.countOne", { n: rows.length })
                : t("history.count", { n: rows.length })}
            </span>
          )}
        </div>
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
        <ul className="bible-yv-history-panel-list" aria-label={t("history.title")}>
          {rows.length === 0 ? (
            <li className="bible-yv-history-panel-empty">{t("history.empty")}</li>
          ) : (
            rows.map(({ eventId, at, item }) => {
              const label = historyDisplayLabel(item, htTitles);
              const text = verseTexts[eventId];
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
                    <span className="bible-yv-history-panel-verse">
                      {text || (textsBusy ? t("common.loading") : "…")}
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
      </div>
    </div>
  );
}
