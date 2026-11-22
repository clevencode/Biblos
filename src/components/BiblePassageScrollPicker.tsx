import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import type { PassageDiscoverySession } from "../bible/passageDiscovery/session";
import { YvIcon } from "./YvIcon";
import type { BibleSearchHit, YouVersionBook } from "../youversion/client";
import { BiblePassageDiscoveryList } from "./BiblePassageDiscoveryList";
import { PASSAGE_LOADING_COPY } from "../bible/viewState/loadingConstants";
import type { PassagePickerChrome } from "../bible/viewState/passagePickerChrome";
import type { DiscoveryJump, PassageDiscoveryResult } from "../bible/passageDiscovery/types";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { useUiLocale } from "../i18n/UiLocaleContext";

export type PassagePickStep = "book" | "chapter" | "verse";

type BiblePassageScrollPickerProps = {
  id?: string;
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
  onDiscoveryChapterGridScroll: (bookId: string, scrollTop: number) => void;
  onDiscoveryVerseGridScroll: (
    bookId: string,
    chapterId: string,
    scrollTop: number,
  ) => void;
  chapters: string[];
  verseOptions: number[];
  passageChrome: PassagePickerChrome;
  highlightVerse: number | null;
  verseSelected: (n: number) => boolean;
  /** Escape no passo livro — fecha o sheet sem limpar a query. */
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onPickBook: (id: string) => void;
  onPickJump: (jump: DiscoveryJump) => void;
  onPickVerse: (hit: BibleSearchHit) => void;
  onPickChapter: (id: string) => void;
  onJumpVerse: (n: number) => void;
  /** Split discovery (test): busca do pill só filtra livros / refs. */
  discoveryBooksOnly?: boolean;
};

function scrollSelectedCellIntoView(grid: HTMLElement) {
  const selected = grid.querySelector(
    ".bible-yv-pick-cell.is-on",
  ) as HTMLElement | null;
  if (!selected) return;
  const gridRect = grid.getBoundingClientRect();
  const cellRect = selected.getBoundingClientRect();
  if (cellRect.top < gridRect.top || cellRect.bottom > gridRect.bottom) {
    selected.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

export const BiblePassageScrollPicker = forwardRef<HTMLDivElement, BiblePassageScrollPickerProps>(
  function BiblePassageScrollPicker(
    {
      id: panelId,
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
      onDiscoveryChapterGridScroll,
      onDiscoveryVerseGridScroll,
      chapters,
      verseOptions,
      passageChrome,
      highlightVerse,
      verseSelected,
      onClose,
      onSearchChange,
      onSearchClear,
      onPickBook,
      onPickJump,
      onPickVerse,
      onPickChapter,
      onJumpVerse,
      discoveryBooksOnly = false,
    },
    ref,
  ) {
    const { t } = useUiLocale();
    const gridRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const restoredScrollKeyRef = useRef<string | null>(null);

    const bookKey = String(bookId || "").toUpperCase();
    const verseGridKey = `${bookKey}:${String(chapterId || "").trim()}`;
    const scrollRestoreKey =
      !open
        ? null
        : step === "book"
          ? "book"
          : step === "chapter"
            ? `chapter:${bookKey}`
            : `verse:${verseGridKey}`;

    useLayoutEffect(() => {
      if (!open || !scrollRestoreKey) {
        restoredScrollKeyRef.current = null;
        return;
      }
      if (restoredScrollKeyRef.current === scrollRestoreKey) return;
      const el = gridRef.current;
      if (!el) return;

      if (step === "book") {
        el.scrollTop = discoverySession.listScrollTop;
      } else if (step === "chapter") {
        const saved = discoverySession.chapterScrollByBook[bookKey];
        el.scrollTop = typeof saved === "number" ? saved : 0;
        scrollSelectedCellIntoView(el);
      } else {
        const saved = discoverySession.verseGridScrollByChapter[verseGridKey];
        el.scrollTop = typeof saved === "number" ? saved : 0;
        scrollSelectedCellIntoView(el);
      }
      restoredScrollKeyRef.current = scrollRestoreKey;
    }, [
      open,
      step,
      scrollRestoreKey,
      bookKey,
      verseGridKey,
      discoverySession.listScrollTop,
      discoverySession.chapterScrollByBook,
      discoverySession.verseGridScrollByChapter,
    ]);

    /** Focus no campo no mesmo frame (padrão search). */
    useLayoutEffect(() => {
      if (!open || step !== "book") return;
      const input = searchInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      if (input.value.trim()) input.select();
    }, [open, step]);

    if (!open) return null;

    function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }

    const ariaLabel =
      step === "book"
        ? "Liste des livres"
        : step === "chapter"
          ? `Chapitres de ${bookTitle}`
          : `Versets du chapitre ${chapterId}`;

    const hasQuery = Boolean(bookSearchQuery.trim());
    const { inFlight } = passageChrome;

    function captureGridScroll() {
      const top = gridRef.current?.scrollTop;
      if (typeof top !== "number") return;
      if (step === "book") onDiscoveryListScroll(top);
      else if (step === "chapter") onDiscoveryChapterGridScroll(bookId, top);
      else onDiscoveryVerseGridScroll(bookId, chapterId, top);
    }

    function handlePickVerse(hit: BibleSearchHit) {
      captureGridScroll();
      onPickVerse(hit);
    }

    function handlePickChapter(id: string) {
      captureGridScroll();
      onPickChapter(id);
    }

    function handleJumpVerse(n: number) {
      captureGridScroll();
      onJumpVerse(n);
    }

    return (
      <div
        ref={ref}
        id={panelId}
        className={`bible-yv-passage-scroll-panel top-floating-sheet is-open is-${step}`}
        data-top-sheet="book"
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
      >
        {step === "book" ? (
          <div className="bible-yv-word-search-field bible-yv-pick-roll-search">
            <YvIcon name="search" opsz={20} className="bible-yv-word-search-field-icon" />
            <input
              ref={searchInputRef}
              type="search"
              className="bible-yv-word-search-input bible-yv-pick-search"
              value={bookSearchQuery}
              placeholder={
                discoveryBooksOnly ? "Livre ou référence…" : "Livre, mot ou référence…"
              }
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-label={
                discoveryBooksOnly
                  ? "Rechercher un livre ou une référence"
                  : "Rechercher un livre, un mot ou une référence"
              }
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {hasQuery ? (
              <button
                type="button"
                className="bible-yv-word-search-clear bible-yv-pick-search-clear"
                onClick={onSearchClear}
                aria-label={t("common.clear")}
              >
                {t("common.clear")}
              </button>
            ) : null}
          </div>
        ) : null}
        <div
          ref={gridRef}
          className={`bible-yv-pick-grid${step === "book" ? " is-books" : ""}`}
          role="listbox"
          onScroll={(event) => {
            const top = event.currentTarget.scrollTop;
            if (step === "book") onDiscoveryListScroll(top);
            else if (step === "chapter") onDiscoveryChapterGridScroll(bookId, top);
            else onDiscoveryVerseGridScroll(bookId, chapterId, top);
          }}
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
              verseDiscoveryEnabled={!discoveryBooksOnly}
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
                      onClick={() => handlePickChapter(id)}
                      disabled={inFlight}
                    >
                      {id}
                    </button>
                  );
                })
              : null
            : verseOptions.map((n) => {
                const on = highlightVerse === n || verseSelected(n);
                return (
                  <button
                    key={n}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`bible-yv-pick-cell${on ? " is-on" : ""}`}
                    onClick={() => handleJumpVerse(n)}
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
        {step === "verse" && !verseOptions.length ? (
          <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">
            {inFlight
              ? PASSAGE_LOADING_COPY.pickerVerseOpening
              : "Aucun verset"}
          </p>
        ) : null}
      </div>
    );
  },
);
