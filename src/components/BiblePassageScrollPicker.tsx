import {
  forwardRef,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { PassageDiscoverySession } from "../bible/passageDiscovery/session";
import type { PickGridScrollKind } from "../bible/passageDiscovery/pickGridScroll";
import { buildChapterIdsByBook } from "../bible/passageDiscovery/chapterIdsByBook";
import type { BibleSearchHit, YouVersionBook } from "../youversion/client";
import { BiblePassageDiscoveryList } from "./BiblePassageDiscoveryList";
import { PASSAGE_LOADING_COPY } from "../bible/viewState/loadingConstants";
import type { PassagePickerChrome } from "../bible/viewState/passagePickerChrome";
import type { DiscoveryJump, PassageDiscoveryResult } from "../bible/passageDiscovery/types";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { YvIcon } from "./YvIcon";

export type PassagePickStep = "book" | "chapter" | "verse";

type BiblePassageScrollPickerProps = {
  id?: string;
  step: PassagePickStep;
  open: boolean;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  bookSearchQuery: string;
  onBookSearchChange: (query: string) => void;
  onClearBookSearch: () => void;
  searchPlaceholder: string;
  searchLabel: string;
  clearSearchLabel: string;
  books: YouVersionBook[];
  discovery: PassageDiscoveryResult;
  discoveryBusy: boolean;
  textVersion: BibleTextVersionId;
  discoverySession: PassageDiscoverySession;
  getPickGridScroll: (
    kind: PickGridScrollKind,
    bookId: string,
    chapterId?: string,
  ) => number | undefined;
  setPickGridScroll: (
    kind: PickGridScrollKind,
    bookId: string,
    chapterId: string | undefined,
    scrollTop: number,
  ) => void;
  onDiscoveryExpandedBookChange: (bookId: string | null) => void;
  onDiscoveryVerseListScroll: (bookId: string, scrollTop: number) => void;
  chapters: string[];
  verseOptions: number[];
  passageChrome: PassagePickerChrome;
  highlightVerse: number | null;
  verseSelected: (n: number) => boolean;
  onPickBook: (id: string) => void;
  onPickJump: (jump: DiscoveryJump) => void;
  onPickVerse: (hit: BibleSearchHit) => void;
  /** Passo chapter legado; acordeão no passo book usa `onPickChapterFromBook`. */
  onPickChapter: (id: string) => void;
  onPickChapterFromBook: (bookId: string, chapterId: string) => void;
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
      onBookSearchChange,
      onClearBookSearch,
      searchPlaceholder,
      searchLabel,
      clearSearchLabel,
      books,
      discovery,
      discoveryBusy,
      textVersion,
      discoverySession,
      getPickGridScroll,
      setPickGridScroll,
      onDiscoveryExpandedBookChange,
      onDiscoveryVerseListScroll,
      chapters,
      verseOptions,
      passageChrome,
      highlightVerse,
      verseSelected,
      onPickBook,
      onPickJump,
      onPickVerse,
      onPickChapter,
      onPickChapterFromBook,
      onJumpVerse,
      discoveryBooksOnly = false,
    },
    ref,
  ) {
    const gridRef = useRef<HTMLDivElement>(null);
    const restoredScrollKeyRef = useRef<string | null>(null);
    /** scrollTop guardado ainda não aplicável (conteúdo por carregar). */
    const pendingScrollRef = useRef<number | null>(null);
    const getPickGridScrollRef = useRef(getPickGridScroll);
    getPickGridScrollRef.current = getPickGridScroll;
    const chapterIdsByBook = useMemo(
      () => buildChapterIdsByBook(books),
      [books],
    );

    const bookKey = String(bookId || "").toUpperCase();
    const chapterKey = String(chapterId || "").trim();
    const scrollRestoreKey = !open
      ? null
      : step === "book"
        ? "book"
        : step === "chapter"
          ? `chapter:${bookKey}`
          : `verse:${bookKey}:${chapterKey}`;

    useLayoutEffect(() => {
      if (!open || !scrollRestoreKey) {
        restoredScrollKeyRef.current = null;
        return;
      }
      if (restoredScrollKeyRef.current === scrollRestoreKey) return;
      const el = gridRef.current;
      if (!el) return;

      const kind: PickGridScrollKind =
        step === "book" ? "book" : step === "chapter" ? "chapter" : "verse";
      const saved = getPickGridScrollRef.current(
        kind,
        bookId,
        step === "verse" ? chapterId : undefined,
      );
      const target = typeof saved === "number" ? saved : 0;
      el.scrollTop = target;
      /*
       * Lista ainda vazia/curta (livros chegam async): o browser corta o
       * scrollTop. Fica pendente e reaplica quando o conteúdo crescer.
       */
      pendingScrollRef.current = el.scrollTop < target - 1 ? target : null;
      if (step === "chapter" || step === "verse") {
        scrollSelectedCellIntoView(el);
      }
      restoredScrollKeyRef.current = scrollRestoreKey;
    }, [open, step, bookId, chapterId, scrollRestoreKey, bookKey, chapterKey]);

    /* Conteúdo chegou (discovery / capítulos / versos): aplica o restore pendente. */
    useLayoutEffect(() => {
      const target = pendingScrollRef.current;
      const el = gridRef.current;
      if (!open || target == null || !el) return;
      el.scrollTop = target;
      if (el.scrollTop >= target - 1) pendingScrollRef.current = null;
    });

    if (!open) return null;

    const ariaLabel =
      step === "book"
        ? "Liste des livres"
        : step === "chapter"
          ? `Chapitres de ${bookTitle}`
          : `Versets du chapitre ${chapterId}`;

    const hasQuery = Boolean(bookSearchQuery.trim());
    const { inFlight } = passageChrome;

    function gridKind(): PickGridScrollKind {
      return step === "book" ? "book" : step === "chapter" ? "chapter" : "verse";
    }

    function captureGridScroll() {
      const top = gridRef.current?.scrollTop;
      if (typeof top !== "number") return;
      setPickGridScroll(
        gridKind(),
        bookId,
        step === "verse" ? chapterId : undefined,
        top,
      );
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
        className={`bible-yv-passage-scroll-panel top-floating-sheet is-open is-${step}${step === "book" ? " has-book-search-bar" : ""}`}
        data-top-sheet="book"
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
      >
        <div
          ref={gridRef}
          className={`bible-yv-pick-grid${step === "book" ? " is-books" : ""}`}
          role="listbox"
          onScroll={(event) => {
            /* Restore pendente: não gravar a posição cortada por cima da guardada. */
            if (pendingScrollRef.current != null) return;
            setPickGridScroll(
              gridKind(),
              bookId,
              step === "verse" ? chapterId : undefined,
              event.currentTarget.scrollTop,
            );
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
              highlightChapterId={chapterId}
              loading={inFlight}
              expandedBookId={discoverySession.expandedBookId}
              anchorVerseUsfm={discoverySession.anchorVerseUsfm}
              verseScrollByBook={discoverySession.verseScrollByBook}
              chapterIdsByBook={chapterIdsByBook}
              onExpandedBookChange={onDiscoveryExpandedBookChange}
              onVerseListScroll={onDiscoveryVerseListScroll}
              onPickBook={onPickBook}
              onPickChapter={onPickChapterFromBook}
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
        {step === "book" ? (
          <nav
            className="bible-yv-pick-book-search-bar"
            aria-label={searchLabel}
          >
            <div className="bible-yv-pick-book-search-pill" role="search">
              <YvIcon
                name="search"
                className="bible-yv-pick-search-trigger-icon"
                aria-hidden
              />
              <input
                type="search"
                className="bible-yv-pick-book-search-input"
                value={bookSearchQuery}
                onChange={(event) => onBookSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchLabel}
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="bible-yv-pick-book-search-clear"
                onClick={onClearBookSearch}
                disabled={!bookSearchQuery.trim()}
                aria-label={clearSearchLabel}
              >
                {clearSearchLabel}
              </button>
            </div>
          </nav>
        ) : null}
      </div>
    );
  },
);
