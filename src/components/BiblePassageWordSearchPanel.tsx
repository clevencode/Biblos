import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import {
  isDcBook,
  isNtBook,
  isOtBook,
} from "../bible/searchTestamentSets";
import {
  normalizeSearchText,
  resolveCanonicalBookId,
  type MatchMode,
  type SearchFacets,
} from "../bible/verseSearchEngine";
import { useUiLocale } from "../i18n/UiLocaleContext";
import type { SearchScopeFilter } from "../hooks/usePersistentSearchSession";
import { useRecentWordSearches } from "../hooks/useRecentWordSearches";
import {
  buildSearchSignature,
  useSearchScrollRestoration,
} from "../hooks/useSearchScrollRestoration";
import {
  WORD_SEARCH_PAGE_SIZE,
  type WordSearchScopeCounts,
} from "../hooks/useWordPassageSearch";
import type { BibleSearchHit, YouVersionBook } from "../youversion/client";
import { YvIcon } from "./YvIcon";
import { BibleSearchHighlight } from "./BibleSearchHighlight";
import { WordSearchSkeleton } from "./WordSearchSkeleton";

const MIN_WORD_CHARS = 2;

/** Gaveta multi-livros: OT / NT / DC. */
type PickerMode = "nt" | "ot" | "dc";

type PanelBook = {
  id: string;
  title: string;
  section: PickerMode;
};

function bookIdsInSection(ids: string[], mode: PickerMode): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = resolveCanonicalBookId(raw);
    if (!id || seen.has(id)) continue;
    const ok =
      mode === "nt"
        ? isNtBook(id)
        : mode === "ot"
          ? isOtBook(id)
          : isDcBook(id);
    if (!ok) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sectionForBook(id: string): PickerMode {
  if (isNtBook(id)) return "nt";
  if (isOtBook(id)) return "ot";
  return "dc";
}

/** Janela compacta: 1 … 4 5 6 … N */
function buildPageItems(
  current: number,
  total: number,
): Array<number | "gap"> {
  if (total <= 1) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("gap");
    out.push(n);
  }
  return out;
}

type BiblePassageWordSearchPanelProps = {
  id: string;
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onQueryClear: () => void;
  onClose: () => void;
  discoveryBusy: boolean;
  verseHits: BibleSearchHit[];
  verseTotal: number;
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  /** Troca de página sem skeleton (stale-while-revalidate). */
  paging?: boolean;
  contentError: string | null;
  textVersion: BibleTextVersionId;
  /** Catálogo da versão ativa (títulos localizados; HT inclui deuterocanônicos). */
  books: YouVersionBook[];
  matchMode?: MatchMode | null;
  matchedTerms?: string[];
  scopeFilter: SearchScopeFilter;
  onScopeFilterChange: (scope: SearchScopeFilter) => void;
  selectedBookIds: string[];
  onSelectedBookIdsChange: (bookIds: string[]) => void;
  scopeCounts?: WordSearchScopeCounts | null;
  facets?: SearchFacets | null;
  currentBookId: string;
  currentBookTitle: string;
  onPickVerse: (hit: BibleSearchHit) => void;
};

/**
 * Painel de busca — pills + gaveta multi-livros + chips por hits + RÉCENTS.
 * Escopo isolado pela versão ativa (`textVersion` + `books`).
 */
export function BiblePassageWordSearchPanel({
  id: panelId,
  open,
  query,
  onQueryChange,
  onQueryClear,
  onClose,
  discoveryBusy,
  verseHits,
  verseTotal,
  page = 1,
  pageCount = 0,
  onPageChange,
  paging = false,
  contentError,
  textVersion,
  books,
  matchMode = null,
  matchedTerms = [],
  scopeFilter,
  onScopeFilterChange,
  selectedBookIds,
  onSelectedBookIdsChange,
  scopeCounts = null,
  facets = null,
  currentBookId,
  currentBookTitle,
  onPickVerse,
}: BiblePassageWordSearchPanelProps) {
  const { t } = useUiLocale();
  const showDcPill = textVersion === "ht98";
  const inputRef = useRef<HTMLInputElement>(null);
  const { chips, isSuggestions, pushRecent } = useRecentWordSearches(textVersion);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [draftBookIds, setDraftBookIds] = useState<string[]>([]);
  const [bookFilterQuery, setBookFilterQuery] = useState("");

  const isBookPickerOpen = pickerMode !== null;

  const catalogBooks = useMemo((): PanelBook[] => {
    return books.map((book) => {
      const id = String(book.id || "").trim().toUpperCase();
      return {
        id,
        title: book.title || book.fullTitle || id,
        section: sectionForBook(id),
      };
    }).filter((b) => Boolean(b.id));
  }, [books]);

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const book of catalogBooks) {
      map.set(book.id, book.title);
    }
    return map;
  }, [catalogBooks]);

  const readerBookId = useMemo(
    () => resolveCanonicalBookId(currentBookId, currentBookTitle),
    [currentBookId, currentBookTitle],
  );

  const trimmed = query.trim();
  const hasActiveQuery = trimmed.length >= MIN_WORD_CHARS;
  /** Skeleton só em nova query/escopo — nunca em paging. */
  const showSkeleton = discoveryBusy && hasActiveQuery && !paging;
  const listBusy = (discoveryBusy || paging) && hasActiveQuery;
  const showEmptyResults =
    hasActiveQuery &&
    !discoveryBusy &&
    !paging &&
    !contentError &&
    verseHits.length === 0 &&
    !isBookPickerOpen;
  const resultsReady =
    hasActiveQuery &&
    !discoveryBusy &&
    !contentError &&
    verseHits.length > 0 &&
    !isBookPickerOpen;
  const hasResultsChrome = hasActiveQuery && !showSkeleton;
  const currentBookActive = scopeFilter === "current_book";
  const ntActive = scopeFilter === "nt";
  const otActive = scopeFilter === "ot";
  const dcActive = scopeFilter === "dc";

  const rangeStart =
    verseHits.length > 0 ? (Math.max(page, 1) - 1) * WORD_SEARCH_PAGE_SIZE + 1 : 0;
  const rangeEnd = rangeStart > 0 ? rangeStart + verseHits.length - 1 : 0;
  const pageItems = useMemo(
    () => buildPageItems(Math.max(page, 1), pageCount),
    [page, pageCount],
  );
  const booksSignature = useMemo(() => {
    if (scopeFilter === "current_book") {
      return `current_book:${readerBookId || ""}`;
    }
    if (scopeFilter === "books" && selectedBookIds.length > 0) {
      return `books:${[...selectedBookIds].sort().join(",")}`;
    }
    if (
      scopeFilter === "nt" ||
      scopeFilter === "ot" ||
      scopeFilter === "dc"
    ) {
      return scopeFilter;
    }
    return "all";
  }, [selectedBookIds, scopeFilter, readerBookId]);

  const searchSignature = useMemo(
    () =>
      buildSearchSignature({
        versionId: textVersion,
        query: trimmed,
        filter: booksSignature,
      }),
    [textVersion, trimmed, booksSignature],
  );

  const { listRef, handleScroll, flushScroll, resetScroll } =
    useSearchScrollRestoration({
      isOpen: open,
      searchSignature,
      resultsCount: verseHits.length,
      page,
      versionId: textVersion,
      resultsReady,
    });

  const bookLabel =
    currentBookTitle.trim() ||
    titleById.get(readerBookId) ||
    currentBookId ||
    t("common.book");

  const outsideBookBanner =
    !showSkeleton &&
    !isBookPickerOpen &&
    scopeFilter !== "current_book" &&
    verseHits.length > 0 &&
    readerBookId &&
    (scopeCounts?.current_book ?? 0) === 0
      ? t("word.outsideBook", { book: bookLabel })
      : null;

  const matchModeBanner =
    !showSkeleton &&
    !isBookPickerOpen &&
    verseHits.length > 0 &&
    (matchMode === "fuzzy"
      ? t("word.fuzzy")
      : matchMode === "partial_or"
        ? t("word.or")
        : null);

  const fallbackBanner = outsideBookBanner || matchModeBanner;
  const byBook = facets?.byBook ?? {};

  const booksWithHits = useMemo(() => {
    const withHits = catalogBooks.filter(
      (book) => (byBook[book.id] ?? 0) > 0,
    );
    if (pickerMode === "nt") {
      return withHits.filter((book) => book.section === "nt");
    }
    if (pickerMode === "ot") {
      return withHits.filter((book) => book.section === "ot");
    }
    if (pickerMode === "dc") {
      return withHits.filter((book) => book.section === "dc");
    }
    return withHits;
  }, [byBook, pickerMode, catalogBooks]);

  const filteredBooks = useMemo(() => {
    const q = normalizeSearchText(bookFilterQuery);
    if (!q) return booksWithHits;
    return booksWithHits.filter(
      (book) =>
        normalizeSearchText(book.title).includes(q) ||
        normalizeSearchText(book.id).includes(q),
    );
  }, [booksWithHits, bookFilterQuery]);

  const draftPassages = useMemo(() => {
    return draftBookIds.reduce(
      (sum, id) => sum + (byBook[id.toUpperCase()] ?? 0),
      0,
    );
  }, [draftBookIds, byBook]);

  const applyEmptyTotal = useMemo(() => {
    if (pickerMode === "nt") return facets?.ntCount ?? scopeCounts?.nt ?? 0;
    if (pickerMode === "ot") return facets?.otCount ?? scopeCounts?.ot ?? 0;
    if (pickerMode === "dc") return facets?.dcCount ?? scopeCounts?.dc ?? 0;
    return facets?.total ?? 0;
  }, [pickerMode, facets, scopeCounts]);

  const bookPillLabel = useMemo(() => {
    const n = readerBookId ? byBook[readerBookId] ?? 0 : 0;
    return hasActiveQuery && n > 0 ? `${bookLabel} (${n})` : bookLabel;
  }, [byBook, readerBookId, bookLabel, hasActiveQuery]);

  useEffect(() => {
    if (!open) {
      setPickerMode(null);
      setBookFilterQuery("");
      return;
    }
    const id = window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (input.value.trim()) input.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  function seedDraftForMode(mode: PickerMode): string[] {
    return bookIdsInSection(selectedBookIds, mode);
  }

  function openBookPicker(mode: PickerMode) {
    setDraftBookIds(seedDraftForMode(mode));
    setBookFilterQuery("");
    setPickerMode(mode);
  }

  function closeBookPicker() {
    setPickerMode(null);
    setBookFilterQuery("");
  }

  function toggleBookPicker(mode: PickerMode) {
    if (pickerMode === mode) {
      closeBookPicker();
      return;
    }
    openBookPicker(mode);
  }

  function handlePickVerse(hit: BibleSearchHit) {
    if (trimmed) pushRecent(trimmed);
    flushScroll();
    onPickVerse(hit);
  }

  function handleClearOrClose() {
    if (trimmed) {
      resetScroll();
      onQueryClear();
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    onClose();
  }

  function handleQueryChange(value: string) {
    if (value !== query) resetScroll();
    onQueryChange(value);
  }

  function handleCurrentBookPillTap() {
    closeBookPicker();
    if (!readerBookId) return;
    if (currentBookActive) return;
    resetScroll();
    onScopeFilterChange("current_book");
  }

  function handleTestamentPillTap(next: PickerMode) {
    const active =
      next === "nt" ? ntActive : next === "ot" ? otActive : dcActive;
    if (!active) {
      closeBookPicker();
      resetScroll();
      onScopeFilterChange(next);
      return;
    }
    toggleBookPicker(next);
  }

  function handleTestamentChevron(event: MouseEvent, next: PickerMode) {
    event.stopPropagation();
    const active =
      next === "nt" ? ntActive : next === "ot" ? otActive : dcActive;
    if (!active) {
      resetScroll();
      onScopeFilterChange(next);
    }
    toggleBookPicker(next);
  }

  function handleEffacerBooks() {
    setDraftBookIds([]);
    if (
      selectedBookIds.length > 0 ||
      scopeFilter === "books" ||
      scopeFilter === "all"
    ) {
      onScopeFilterChange("current_book");
    }
  }

  function toggleDraftBook(bookId: string) {
    const id = resolveCanonicalBookId(bookId);
    if (!id) return;
    setDraftBookIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleApplyBooks() {
    const nextIds = draftBookIds
      .map((id) => resolveCanonicalBookId(id))
      .filter(Boolean);
    resetScroll();
    if (nextIds.length === 0) {
      if (pickerMode === "nt" || pickerMode === "ot" || pickerMode === "dc") {
        onScopeFilterChange(pickerMode);
      } else {
        onScopeFilterChange("current_book");
      }
    } else if (
      nextIds.length === 1 &&
      nextIds[0] === readerBookId
    ) {
      // Um único livro = o do leitor → escopo dinâmico (segue a navegação)
      onScopeFilterChange("current_book");
    } else {
      onSelectedBookIdsChange(nextIds);
    }
    closeBookPicker();
  }

  function handleRecentChip(term: string) {
    closeBookPicker();
    resetScroll();
    onQueryChange(term);
    pushRecent(term);
    window.setTimeout(() => inputRef.current?.blur(), 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      inputRef.current?.blur();
      if (trimmed.length >= MIN_WORD_CHARS) pushRecent(trimmed);
    }
  }

  function countLabel(scope: PickerMode): string {
    const base =
      scope === "nt"
        ? t("word.nt")
        : scope === "ot"
          ? t("word.ot")
          : t("word.dc");
    if (!hasActiveQuery || !scopeCounts) return base;
    return `${base} (${scopeCounts[scope]})`;
  }

  const displayError = contentError
    ? contentError === "unavailable" || /indisponible|unavailable/i.test(contentError)
      ? t("word.unavailable")
      : contentError
    : null;

  return (
    <div
      id={panelId}
      className={`bible-yv-passage-word-search-panel is-open${
        hasResultsChrome || isBookPickerOpen ? " has-results" : " is-compact"
      }${isBookPickerOpen ? " is-book-picker" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label={t("word.panel")}
    >
      <div className="bible-yv-word-search-field">
        <YvIcon name="search" opsz={20} className="bible-yv-word-search-field-icon" />
        <input
          ref={inputRef}
          type="search"
          className="bible-yv-word-search-input"
          value={query}
          placeholder={t("word.placeholder")}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label={t("word.aria")}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="bible-yv-word-search-clear"
          onClick={handleClearOrClose}
          aria-label={trimmed ? t("common.clear") : t("common.close")}
        >
          <YvIcon name="close" opsz={20} className="bible-yv-word-search-clear-icon" />
        </button>
      </div>

      <div
        className="bible-yv-word-search-pills"
        role="tablist"
        aria-label={t("word.panel")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={currentBookActive}
          className={`bible-yv-word-search-pill${currentBookActive ? " is-on" : ""}`}
          onClick={handleCurrentBookPillTap}
        >
          {bookPillLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={ntActive}
          aria-expanded={pickerMode === "nt"}
          className={`bible-yv-word-search-pill bible-yv-word-search-pill--books${
            ntActive ? " is-on" : ""
          }`}
          onClick={() => handleTestamentPillTap("nt")}
        >
          <span className="bible-yv-word-search-pill-books-label">
            {countLabel("nt")}
          </span>
          <span
            className="bible-yv-word-search-pill-chevron"
            onClick={(event) => handleTestamentChevron(event, "nt")}
            role="presentation"
          >
            ▾
          </span>
        </button>
        {showDcPill ? (
          <button
            type="button"
            role="tab"
            aria-selected={dcActive}
            aria-expanded={pickerMode === "dc"}
            className={`bible-yv-word-search-pill bible-yv-word-search-pill--books${
              dcActive ? " is-on" : ""
            }`}
            onClick={() => handleTestamentPillTap("dc")}
          >
            <span className="bible-yv-word-search-pill-books-label">
              {countLabel("dc")}
            </span>
            <span
              className="bible-yv-word-search-pill-chevron"
              onClick={(event) => handleTestamentChevron(event, "dc")}
              role="presentation"
            >
              ▾
            </span>
          </button>
        ) : null}
        <button
          type="button"
          role="tab"
          aria-selected={otActive}
          aria-expanded={pickerMode === "ot"}
          className={`bible-yv-word-search-pill bible-yv-word-search-pill--books${
            otActive ? " is-on" : ""
          }`}
          onClick={() => handleTestamentPillTap("ot")}
        >
          <span className="bible-yv-word-search-pill-books-label">
            {countLabel("ot")}
          </span>
          <span
            className="bible-yv-word-search-pill-chevron"
            onClick={(event) => handleTestamentChevron(event, "ot")}
            role="presentation"
          >
            ▾
          </span>
        </button>
      </div>

      {!hasActiveQuery ? (
        <div className="bible-yv-word-search-recents">
          <p className="bible-yv-word-search-recents-label">
            {isSuggestions ? t("word.suggestions") : t("word.recents")}
          </p>
          <div className="bible-yv-word-search-recents-chips">
            {chips.map((term) => (
              <button
                key={term}
                type="button"
                className="bible-yv-word-search-recent-chip"
                onClick={() => handleRecentChip(term)}
              >
                <span className="bible-yv-word-search-recent-chip-icon" aria-hidden>
                  🕒
                </span>
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : isBookPickerOpen ? (
        <div className="bible-yv-word-search-book-picker">
          <div className="bible-yv-word-search-book-picker-header">
            <input
              type="search"
              className="bible-yv-word-search-book-filter"
              value={bookFilterQuery}
              placeholder={t("word.filterBook")}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setBookFilterQuery(event.target.value)}
            />
            <button
              type="button"
              className="bible-yv-word-search-book-clear"
              disabled={draftBookIds.length === 0 && selectedBookIds.length === 0}
              onClick={handleEffacerBooks}
            >
              {t("common.clear")}
            </button>
          </div>
          <ul className="bible-yv-word-search-book-list" role="listbox">
            {filteredBooks.length === 0 ? (
              <li className="bible-yv-word-search-book-empty bible-yv-muted">
                {t("word.emptyBooks")}
              </li>
            ) : (
              filteredBooks.map((book) => {
                const id = book.id;
                const checked = draftBookIds.includes(id);
                const count = byBook[id] ?? 0;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      className={`bible-yv-word-search-book-row${
                        checked ? " is-on" : ""
                      }`}
                      onClick={() => toggleDraftBook(id)}
                    >
                      <span
                        className={`bible-yv-word-search-book-check${
                          checked ? " is-on" : ""
                        }`}
                        aria-hidden
                      >
                        {checked ? "☑" : "☐"}
                      </span>
                      <span className="bible-yv-word-search-book-name">
                        {book.title}
                      </span>
                      <span className="bible-yv-word-search-book-count">
                        ({count})
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="bible-yv-word-search-book-footer">
            <button
              type="button"
              className="bible-yv-word-search-book-apply"
              onClick={handleApplyBooks}
            >
              {draftBookIds.length > 0
                ? t("word.apply", { n: draftPassages })
                : t("word.showAll", { n: applyEmptyTotal })}
            </button>
          </div>
        </div>
      ) : (
        <>
          {!showSkeleton && verseHits.length > 0 ? (
            <p className="bible-yv-word-search-meta bible-yv-muted" aria-live="polite">
              {pageCount > 1
                ? t("word.range", {
                    start: rangeStart,
                    end: rangeEnd,
                    total: verseTotal,
                  })
                : t("word.count", { n: verseTotal || verseHits.length })}
            </p>
          ) : null}

          {fallbackBanner ? (
            <p className="bible-yv-word-search-fallback bible-yv-muted" role="status">
              {fallbackBanner}
            </p>
          ) : null}

          <div
            ref={listRef}
            className={`bible-yv-pick-grid is-word-search${
              paging ? " is-paging" : ""
            }`}
            role="listbox"
            aria-label={t("word.panel")}
            aria-busy={listBusy || undefined}
            style={{ overflowAnchor: "none" }}
            onScroll={handleScroll}
          >
            {showSkeleton ? (
              <WordSearchSkeleton />
            ) : displayError ? (
              <p className="bible-yv-pick-discovery-hint bible-yv-muted" role="status">
                {displayError}
              </p>
            ) : showEmptyResults ? (
              <p
                className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty"
                role="status"
              >
                {scopeFilter === "current_book"
                  ? t("word.emptyInBook", {
                      query: trimmed,
                      book: bookLabel,
                    })
                  : t("word.empty")}
              </p>
            ) : (
              <ul className="bible-yv-pick-verse-hits is-word-search-passages">
                {verseHits.map((hit) => {
                  const usfmBook = String(hit.usfm || "")
                    .split(".")[0]
                    ?.toUpperCase();
                  // Títulos só do catálogo da versão / índice (nunca CANON_BOOKS FR)
                  const localizedTitle =
                    (usfmBook ? titleById.get(usfmBook) : null) ||
                    hit.bookTitle ||
                    usfmBook ||
                    "";
                  return (
                    <li key={hit.usfm}>
                      <button
                        type="button"
                        role="option"
                        className="bible-yv-pick-verse-hit"
                        onClick={() => handlePickVerse(hit)}
                      >
                        <span className="bible-yv-pick-verse-hit-ref">
                          {localizedTitle} {hit.chapter}.{hit.verse}
                        </span>
                        <span className="bible-yv-pick-verse-hit-snippet">
                          <BibleSearchHighlight
                            text={hit.snippet || hit.text}
                            query={query}
                            matchedTerms={matchedTerms}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {pageCount > 1 &&
            !showSkeleton &&
            !displayError &&
            verseHits.length > 0 ? (
              <nav
                className="bible-yv-word-search-pagination"
                aria-label={t("word.pagination")}
              >
                {pageItems.map((item, index) =>
                  item === "gap" ? (
                    <span
                      key={`gap-${index}`}
                      className="bible-yv-word-search-page-gap"
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={`bible-yv-word-search-page${
                        item === page ? " is-current" : ""
                      }`}
                      aria-label={t("word.page", { n: item })}
                      aria-current={item === page ? "page" : undefined}
                      disabled={discoveryBusy || paging || item === page}
                      onClick={() => onPageChange?.(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
              </nav>
            ) : null}
          </div>
          <div className="bible-yv-passage-scroll-edge" aria-hidden />
        </>
      )}
    </div>
  );
}
