import { useEffect, useId, useState } from "react";
import type { HistorySelectPayload } from "../bible/readingHistoryRepository";
import {
  listAllVerseMarks,
  subscribeVerseMarksRevision,
  type SavedVerseMark,
} from "../verseMarks";
import { useUiLocale } from "../i18n/UiLocaleContext";

export type BibleMarksSelect = HistorySelectPayload;

export type BibleMarksSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: BibleMarksSelect) => void;
};

function markToSelect(mark: SavedVerseMark): BibleMarksSelect {
  return {
    versionId: "s21",
    bookId: mark.bookId,
    chapterId: mark.chapterId,
    verse: mark.verse,
  };
}

/** Full-bleed surlignages — mesmo contrato visual que search/history. */
export function BibleMarksSheet({
  open,
  onClose,
  onSelect,
}: BibleMarksSheetProps) {
  const { t } = useUiLocale();
  const titleId = useId();
  const [marks, setMarks] = useState<SavedVerseMark[]>([]);

  useEffect(() => {
    if (!open) return;
    setMarks(listAllVerseMarks());
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

  if (!open) return null;

  return (
    <div
      className="bible-yv-marks-panel bible-yv-history-panel top-floating-sheet is-open"
      role="dialog"
      aria-modal="false"
      aria-label={t("profile.marks")}
    >
      <span id={titleId} className="sr-only">
        {t("profile.marks")}
      </span>
      {marks.length > 0 ? (
        <div className="bible-yv-history-panel-meta" aria-live="polite">
          <span>{marks.length}</span>
        </div>
      ) : null}

      <div className="bible-yv-history-panel-body">
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
      </div>
    </div>
  );
}
