import { useEffect, useId, useState } from "react";
import type { HistorySelectPayload } from "../bible/readingHistoryRepository";
import { offlinePassage } from "../bibleOffline";
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
  /** Título localizado do livro (ex. Jean) — evita USFM na lista. */
  resolveBookTitle?: (bookId: string) => string;
};

function markToSelect(mark: SavedVerseMark): BibleMarksSelect {
  return {
    versionId: "s21",
    bookId: mark.bookId,
    chapterId: mark.chapterId,
    verse: mark.verse,
  };
}

function markDisplayLabel(
  mark: SavedVerseMark,
  resolveBookTitle?: (bookId: string) => string,
): string {
  const book = resolveBookTitle?.(mark.bookId)?.trim() || mark.bookId;
  return `${book} ${mark.chapterId}.${mark.verse}`;
}

/** Texto dos versículos por chave de mark — um fetch por capítulo. */
async function loadMarkVerseTexts(
  marks: SavedVerseMark[],
): Promise<Record<string, string>> {
  const byChapter = new Map<string, SavedVerseMark[]>();
  for (const mark of marks) {
    const key = `${mark.bookId}.${mark.chapterId}`;
    const list = byChapter.get(key);
    if (list) list.push(mark);
    else byChapter.set(key, [mark]);
  }

  const out: Record<string, string> = {};
  await Promise.all(
    [...byChapter.entries()].map(async ([chapterKey, group]) => {
      try {
        const result = await offlinePassage(chapterKey);
        if (!result.ok) return;
        const byNumber = new Map(
          (result.passage.verses ?? []).map((verse) => [
            verse.number,
            String(verse.text || "").trim(),
          ]),
        );
        for (const mark of group) {
          const text = byNumber.get(mark.verse);
          if (text) out[mark.key] = text;
        }
      } catch {
        /* ignore chapter */
      }
    }),
  );
  return out;
}

/** Full-bleed surlignages — mesmo contrato visual que search/history. */
export function BibleMarksSheet({
  open,
  onClose,
  onSelect,
  resolveBookTitle,
}: BibleMarksSheetProps) {
  const { t } = useUiLocale();
  const titleId = useId();
  const [marks, setMarks] = useState<SavedVerseMark[]>([]);
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({});
  const [textsBusy, setTextsBusy] = useState(false);

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
    if (!open || marks.length === 0) {
      setVerseTexts({});
      setTextsBusy(false);
      return;
    }
    let cancelled = false;
    setTextsBusy(true);
    void loadMarkVerseTexts(marks).then((map) => {
      if (cancelled) return;
      setVerseTexts(map);
      setTextsBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, marks]);

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
            {marks.map((mark) => {
              const refLabel = markDisplayLabel(mark, resolveBookTitle);
              const text = verseTexts[mark.key];
              return (
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
                      {refLabel}
                    </span>
                    <span className="bible-yv-history-panel-verse">
                      {text ||
                        (textsBusy ? t("common.loading") : "…")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
