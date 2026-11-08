import { forwardRef, useLayoutEffect, useRef } from "react";
import type { PassageDiscoverySession } from "../bible/passageDiscovery/session";
import { YvIcon } from "./YvIcon";
import type { BibleSearchHit, YouVersionBook } from "../youversion/client";
import { BiblePassageDiscoveryList } from "./BiblePassageDiscoveryList";
import { BiblePickGridSkeleton } from "./BiblePickGridSkeleton";
import {
  buildChapterPickerSkeleton,
  buildVersePickerSkeleton,
} from "../bible/viewState/pickerViewState";
import { PASSAGE_LOADING_COPY } from "../bible/viewState/loadingConstants";
import type { PassagePickerChrome } from "../bible/viewState/passagePickerChrome";
import type { DiscoveryJump, PassageDiscoveryResult } from "../bible/passageDiscovery/types";
import type { BibleTextVersionId } from "../bible/bibleVersions";

export type PassagePickStep = "book" | "chapter" | "verse";

type BiblePassageScrollPickerProps = {
  step: PassagePickStep;
  open: boolean;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  bookSearchQuery: string;
  books: YouVersionBook[];
  discovery: PassageDiscoveryResult;
  discoveryBusy: boolean;
  textVersion: BibleTextVersionId;
  discoverySession: PassageDiscoverySession;
  onDiscoveryListScroll: (scrollTop: number) => void;
  onDiscoveryExpandedBookChange: (bookId: string | null) => void;
  onDiscoveryVerseListScroll: (bookId: string, scrollTop: number) => void;
  chapters: string[];
  verseOptions: number[];
  passageChrome: PassagePickerChrome;
  highlightVerse: number | null;
  verseSelected: (n: number) => boolean;
  onBack: () => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onPickBook: (id: string) => void;
  onPickJump: (jump: DiscoveryJump) => void;
  onPickVerse: (hit: BibleSearchHit) => void;
  onPickChapter: (id: string) => void;
  onJumpVerse: (n: number) => void;
};

export const BiblePassageScrollPicker = forwardRef<HTMLDivElement, BiblePassageScrollPickerProps>(
  function BiblePassageScrollPicker(
    {
      step,
      open,
      bookId,
      bookTitle,
      chapterId,
      bookSearchQuery,
      books,
      discovery,
      discoveryBusy,
      textVersion,
      discoverySession,
      onDiscoveryListScroll,
      onDiscoveryExpandedBookChange,
      onDiscoveryVerseListScroll,
      chapters,
      verseOptions,
      passageChrome,
      highlightVerse,
      verseSelected,
      onBack,
      onSearchChange,
      onSearchClear,
      onPickBook,
      onPickJump,
      onPickVerse,
      onPickChapter,
      onJumpVerse,
    },
    ref,
  ) {
    const gridRef = useRef<HTMLDivElement>(null);
    const restoredListScrollRef = useRef(false);

    useLayoutEffect(() => {
      if (!open) {
        restoredListScrollRef.current = false;
        return;
      }
      if (step !== "book" || restoredListScrollRef.current) return;
      const el = gridRef.current;
      if (!el) return;
      el.scrollTop = discoverySession.listScrollTop;
      restoredListScrollRef.current = true;
    }, [open, step]);

    if (!open) return null;

    const ariaLabel =
      step === "book"
        ? "Liste des livres"
        : step === "chapter"
          ? `Chapitres de ${bookTitle}`
          : `Versets du chapitre ${chapterId}`;

    const hasQuery = Boolean(bookSearchQuery.trim());
    const { inFlight, showDeferredUi, schema: passageSchema } = passageChrome;
    const verseGridSchema =
      passageSchema && showDeferredUi
        ? buildVersePickerSkeleton(passageSchema.usfm, passageSchema.gridVerseSlots)
        : buildVersePickerSkeleton(
            `${bookId}.${chapterId}`,
            Math.min(50, Math.max(verseOptions.length, 24)),
          );
    const chapterGridSchema = buildChapterPickerSkeleton(bookId);

    function handlePickVerse(hit: BibleSearchHit) {
      if (gridRef.current) {
        onDiscoveryListScroll(gridRef.current.scrollTop);
      }
      onPickVerse(hit);
    }

    return (
      <div
        ref={ref}
        className={`bible-yv-passage-scroll-panel is-open is-header-roll is-${step}`}
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
      >
        {step === "book" ? (
          <div className="bible-yv-pick-roll-search">
            <YvIcon name="search" opsz={20} className="bible-yv-pick-roll-search-icon" />
            <input
              type="search"
              className="bible-yv-pick-search"
              value={bookSearchQuery}
              placeholder="Livre, mot ou référence…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-label="Rechercher un livre, un mot ou une référence"
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {hasQuery ? (
              <button
                type="button"
                className="bible-yv-pick-search-clear"
                onClick={onSearchClear}
                aria-label="Effacer la recherche"
              >
                <YvIcon name="close" opsz={20} className="bible-yv-pick-search-clear-icon" />
              </button>
            ) : null}
          </div>
        ) : step === "verse" ? (
          <div className="bible-yv-pick-roll-subhead">
            <button
              type="button"
              className="bible-yv-pick-roll-back"
              onClick={onBack}
              aria-label={`Retour aux chapitres de ${bookTitle}`}
            >
              <YvIcon name="chevron_left" className="bible-yv-pick-exit-icon" />
            </button>
            <span className="bible-yv-pick-roll-subhead-label">Verset</span>
          </div>
        ) : step === "chapter" ? (
          <div className="bible-yv-pick-roll-subhead">
            <button
              type="button"
              className="bible-yv-pick-roll-back"
              onClick={onBack}
              aria-label={`Retour à la liste des livres`}
            >
              <YvIcon name="chevron_left" className="bible-yv-pick-exit-icon" />
            </button>
            <span className="bible-yv-pick-roll-subhead-label">{bookTitle}</span>
          </div>
        ) : null}
        <div
          ref={step === "book" ? gridRef : undefined}
          className={`bible-yv-pick-grid${step === "book" ? " is-books" : ""}`}
          role="listbox"
          onScroll={
            step === "book"
              ? (event) => onDiscoveryListScroll(event.currentTarget.scrollTop)
              : undefined
          }
        >
          {step === "book" ? (
            <BiblePassageDiscoveryList
              sections={discovery.sections}
              jumps={discovery.jumps}
              busy={discoveryBusy}
              contentError={discovery.contentError}
              textVersion={textVersion}
              hasQuery={hasQuery}
              searchQuery={bookSearchQuery}
              bookId={bookId}
              loading={inFlight}
              expandedBookId={discoverySession.expandedBookId}
              anchorVerseUsfm={discoverySession.anchorVerseUsfm}
              verseScrollByBook={discoverySession.verseScrollByBook}
              onExpandedBookChange={onDiscoveryExpandedBookChange}
              onVerseListScroll={onDiscoveryVerseListScroll}
              onPickBook={onPickBook}
              onPickJump={onPickJump}
              onPickVerse={handlePickVerse}
            />
          ) : step === "chapter"
            ? chapters.length
              ? chapters.map((id) => {
                  const on = id === chapterId;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`bible-yv-pick-cell${on ? " is-on" : ""}`}
                      onClick={() => onPickChapter(id)}
                      disabled={inFlight}
                    >
                      {id}
                    </button>
                  );
                })
              : (
                <BiblePickGridSkeleton schema={chapterGridSchema} role="presentation" />
              )
            : showDeferredUi
              ? (
                <BiblePickGridSkeleton schema={verseGridSchema} role="presentation" />
              )
              : verseOptions.map((n) => {
                const on = highlightVerse === n || verseSelected(n);
                return (
                  <button
                    key={n}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`bible-yv-pick-cell${on ? " is-on" : ""}`}
                    onClick={() => onJumpVerse(n)}
                    disabled={inFlight}
                  >
                    {n}
                  </button>
                );
              })}
        </div>
        {step === "book" && !books.length ? (
          <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">
            {PASSAGE_LOADING_COPY.pickerPreparingBooks}
          </p>
        ) : null}
        {step === "verse" && showDeferredUi ? (
          <p className="bible-yv-pick-roll-status bible-yv-muted" role="status">
            {PASSAGE_LOADING_COPY.pickerVerseOpening}
          </p>
        ) : null}
        {step === "verse" && !showDeferredUi && !verseOptions.length ? (
          <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">Aucun verset</p>
        ) : null}
        <div className="bible-yv-passage-scroll-edge" aria-hidden />
      </div>
    );
  },
);
