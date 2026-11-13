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
import { wordSearchUi } from "../bible/wordSearchUi";
import {
  normalizeSearchText,
  resolveCanonicalBookId,
  type MatchMode,
  type SearchFacets,
} from "../bible/verseSearchEngine";
import type { SearchScopeFilter } from "../hooks/usePersistentSearchSession";
import { useRecentWordSearches } from "../hooks/useRecentWordSearches";
import {
  buildSearchSignature,
  useSearchScrollRestoration,
} from "../hooks/useSearchScrollRestoration";
import type { WordSearchScopeCounts } from "../hooks/useWordPassageSearch";
import type { BibleSearchHit, YouVersionBook } from "../youversion/client";
import { YvIcon } from "./YvIcon";
import { BibleSearchHighlight } from "./BibleSearchHighlight";
import { WordSearchSkeleton } from "./WordSearchSkeleton";

const MIN_WORD_CHARS = 2;
const HIT_LIMIT = 40;

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
  const ui = useMemo(() => wordSearchUi(textVersion), [textVersion]);
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
  const showSkeleton = discoveryBusy && hasActiveQuery;
  const showEmptyResults =
    hasActiveQuery &&
    !discoveryBusy &&
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
  const currentBookActive =
    scopeFilter === "books" &&
    selectedBookIds.length === 1 &&
    resolveCanonicalBookId(selectedBookIds[0]) === readerBookId;
  const ntActive = scopeFilter === "nt";
  const otActive = scopeFilter === "ot";
  const dcActive = scopeFilter === "dc";

  const loadedLimit = Math.max(verseHits.length, HIT_LIMIT);
  const booksSignature = useMemo(() => {
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
  }, [selectedBookIds, scopeFilter]);

  const searchSignature = useMemo(
    () =>
      buildSearchSignature({
        versionId: textVersion,
        query: trimmed,
        filter: booksSignature,
        loadedLimit,
      }),
    [textVersion, trimmed, booksSignature, loadedLimit],
  );

  const { listRef, handleScroll, flushScroll, resetScroll } =
    useSearchScrollRestoration({
      isOpen: open,
      searchSignature,
      resultsCount: verseHits.length,
      loadedLimit,
      resultsReady,
    });

  const fallbackBanner =
    !showSkeleton &&
    !isBookPickerOpen &&
    verseHits.length > 0 &&
    (matchMode === "fuzzy"
      ? ui.fuzzyBanner
      : matchMode === "partial_or"
        ? ui.orBanner
        : null);

  const bookLabel =
    currentBookTitle.trim() ||
    titleById.get(readerBookId) ||
    currentBookId ||
    ui.bookFallback;
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
    onSelectedBookIdsChange([readerBookId]);
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
    if (selectedBookIds.length > 0 || scopeFilter === "books") {
      onScopeFilterChange("all");
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
        onScopeFilterChange("all");
      }
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
      scope === "nt" ? ui.nt : scope === "ot" ? ui.ot : ui.dc;
    if (!hasActiveQuery || !scopeCounts) return base;
    return `${base} (${scopeCounts[scope]})`;
  }

  const displayError =
    contentError === "unavailable" ? ui.unavailable : contentError;

  return (
    <div
      id={panelId}
      className={`bible-yv-passage-word-search-panel is-open${
        hasResultsChrome || isBookPickerOpen ? " has-results" : " is-compact"
      }${isBookPickerOpen ? " is-book-picker" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label={ui.ariaPanel}
    >
      <div className="bible-yv-word-search-field">
        <YvIcon name="search" opsz={20} className="bible-yv-word-search-field-icon" />
        <input
          ref={inputRef}
          type="search"
          className="bible-yv-word-search-input"
          value={query}
          placeholder={ui.placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label={ui.ariaLabel}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="bible-yv-word-search-clear"
          onClick={handleClearOrClose}
          aria-label={trimmed ? ui.clear : ui.close}
        >
          <YvIcon name="close" opsz={20} className="bible-yv-word-search-clear-icon" />
        </button>
      </div>

      <div
        className="bible-yv-word-search-pills"
        role="tablist"
        aria-label={ui.ariaPanel}
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
            {isSuggestions ? ui.suggestions : ui.recents}
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
              placeholder={ui.filterBook}
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
              {ui.clear}
            </button>
          </div>
          <ul className="bible-yv-word-search-book-list" role="listbox">
            {filteredBooks.length === 0 ? (
              <li className="bible-yv-word-search-book-empty bible-yv-muted">
                {ui.empty}
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
                ? ui.applyPassages(draftPassages)
                : ui.showAll(applyEmptyTotal)}
            </button>
          </div>
        </div>
      ) : (
        <>
          {!showSkeleton && verseHits.length > 0 ? (
            <p className="bible-yv-word-search-meta bible-yv-muted" aria-live="polite">
              {verseTotal > verseHits.length
                ? ui.passagesPartial(verseHits.length, verseTotal)
                : ui.passagesCount(verseHits.length)}
            </p>
          ) : null}

          {fallbackBanner ? (
            <p className="bible-yv-word-search-fallback bible-yv-muted" role="status">
              {fallbackBanner}
            </p>
          ) : null}

          <div
            ref={listRef}
            className="bible-yv-pick-grid is-word-search"
            role="listbox"
            aria-label={ui.ariaPanel}
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
              <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">
                {ui.empty}
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
          </div>
          <div className="bible-yv-passage-scroll-edge" aria-hidden />
        </>
      )}
    </div>
  );
}
