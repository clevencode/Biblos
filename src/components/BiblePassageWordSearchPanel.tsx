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
import { CANON_BOOKS } from "../youversion/canon";
import type { BibleSearchHit } from "../youversion/client";
import { YvIcon } from "./YvIcon";
import { BibleSearchHighlight } from "./BibleSearchHighlight";
import { WordSearchSkeleton } from "./WordSearchSkeleton";

const MIN_WORD_CHARS = 2;
const HIT_LIMIT = 40;

/** Gaveta multi-livros só em Ancien / Nouveau. */
type PickerMode = "nt" | "ot";

const OT_BOOK_IDS = new Set(
  CANON_BOOKS.filter((b) => b.testament === "at").map((b) => b.id.toUpperCase()),
);
const NT_BOOK_IDS = new Set(
  CANON_BOOKS.filter((b) => b.testament === "nt").map((b) => b.id.toUpperCase()),
);

function bookIdsInTestament(ids: string[], mode: "nt" | "ot"): string[] {
  const allowed = mode === "nt" ? NT_BOOK_IDS : OT_BOOK_IDS;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = resolveCanonicalBookId(raw);
    if (!id || !allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
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
  contentError: string | null;
  textVersion: BibleTextVersionId;
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
 * Painel de busca — pills + gaveta multi-livros (também AT/NT) + RÉCENTS.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const { chips, isSuggestions, pushRecent } = useRecentWordSearches();
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [draftBookIds, setDraftBookIds] = useState<string[]>([]);
  const [bookFilterQuery, setBookFilterQuery] = useState("");

  const isBookPickerOpen = pickerMode !== null;

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
  /** Pill do livro atual: ativo só quando o filtro é exatamente esse livro. */
  const currentBookActive =
    scopeFilter === "books" &&
    selectedBookIds.length === 1 &&
    resolveCanonicalBookId(selectedBookIds[0]) === readerBookId;
  const ntActive = scopeFilter === "nt";
  const otActive = scopeFilter === "ot";

  const loadedLimit = Math.max(verseHits.length, HIT_LIMIT);
  const booksSignature = useMemo(() => {
    if (scopeFilter === "books" && selectedBookIds.length > 0) {
      return `books:${[...selectedBookIds].sort().join(",")}`;
    }
    if (scopeFilter === "nt" || scopeFilter === "ot") return scopeFilter;
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
      ? "Aucun résultat exact. Affichage des passages pour des termes proches."
      : matchMode === "partial_or"
        ? "Aucun verset avec tous les mots. Passages contenant une partie de votre recherche :"
        : null);

  const bookLabel = currentBookTitle.trim() || currentBookId || "Livre";
  const byBook = facets?.byBook ?? {};

  const booksWithHits = useMemo(() => {
    const withHits = CANON_BOOKS.filter(
      (book) => (byBook[book.id.toUpperCase()] ?? 0) > 0,
    );
    if (pickerMode === "nt") {
      return withHits.filter((book) => book.testament === "nt");
    }
    if (pickerMode === "ot") {
      return withHits.filter((book) => book.testament === "at");
    }
    return withHits;
  }, [byBook, pickerMode]);

  const filteredBooks = useMemo(() => {
    const q = normalizeSearchText(bookFilterQuery);
    if (!q) return booksWithHits;
    return booksWithHits.filter((book) =>
      normalizeSearchText(book.title).includes(q),
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
    return bookIdsInTestament(selectedBookIds, mode);
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

  /** Pill do livro atual: só liga/desliga o filtro desse livro (sem gaveta). */
  function handleCurrentBookPillTap() {
    closeBookPicker();
    if (!readerBookId) return;
    if (currentBookActive) return;
    resetScroll();
    onSelectedBookIdsChange([readerBookId]);
  }

  /** 1º toque: ativa o testamento. 2º toque: gaveta só com livros desse testamento. */
  function handleTestamentPillTap(next: "nt" | "ot") {
    const active = next === "nt" ? ntActive : otActive;
    if (!active) {
      closeBookPicker();
      resetScroll();
      onScopeFilterChange(next);
      return;
    }
    toggleBookPicker(next);
  }

  function handleTestamentChevron(event: MouseEvent, next: "nt" | "ot") {
    event.stopPropagation();
    const active = next === "nt" ? ntActive : otActive;
    if (!active) {
      resetScroll();
      onScopeFilterChange(next);
    }
    toggleBookPicker(next);
  }

  /** Único caminho que anula o histórico de livros selecionados. */
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
      if (pickerMode === "nt" || pickerMode === "ot") {
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

  function countLabel(scope: "nt" | "ot"): string {
    const base = scope === "nt" ? "Nouveau" : "Ancien";
    if (!hasActiveQuery || !scopeCounts) return base;
    return `${base} (${scopeCounts[scope]})`;
  }

  return (
    <div
      id={panelId}
      className={`bible-yv-passage-word-search-panel is-open${
        hasResultsChrome || isBookPickerOpen ? " has-results" : " is-compact"
      }${isBookPickerOpen ? " is-book-picker" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label="Recherche dans la Bible"
    >
      <div className="bible-yv-word-search-field">
        <YvIcon name="search" opsz={20} className="bible-yv-word-search-field-icon" />
        <input
          ref={inputRef}
          type="search"
          className="bible-yv-word-search-input"
          value={query}
          placeholder="Mot ou expression…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label="Rechercher un mot ou une expression dans la Bible"
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="bible-yv-word-search-clear"
          onClick={handleClearOrClose}
          aria-label={trimmed ? "Effacer la recherche" : "Fermer la recherche"}
        >
          <YvIcon name="close" opsz={20} className="bible-yv-word-search-clear-icon" />
        </button>
      </div>

      <div
        className="bible-yv-word-search-pills"
        role="tablist"
        aria-label="Portée de la recherche"
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
            {isSuggestions ? "SUGGESTIONS" : "RÉCENTS"}
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
              placeholder="Filtrer un livre…"
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
              Effacer
            </button>
          </div>
          <ul className="bible-yv-word-search-book-list" role="listbox">
            {filteredBooks.length === 0 ? (
              <li className="bible-yv-word-search-book-empty bible-yv-muted">
                Aucun livre avec des résultats
              </li>
            ) : (
              filteredBooks.map((book) => {
                const id = book.id.toUpperCase();
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
                ? `Appliquer (${draftPassages} passages)`
                : `Tout afficher (${applyEmptyTotal})`}
            </button>
          </div>
        </div>
      ) : (
        <>
          {!showSkeleton && verseHits.length > 0 ? (
            <p className="bible-yv-word-search-meta bible-yv-muted" aria-live="polite">
              {verseTotal > verseHits.length
                ? `${verseHits.length} sur ${verseTotal} passages`
                : `${verseHits.length} passage${verseHits.length === 1 ? "" : "s"}`}
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
            aria-label="Passages"
            style={{ overflowAnchor: "none" }}
            onScroll={handleScroll}
          >
            {showSkeleton ? (
              <WordSearchSkeleton />
            ) : contentError ? (
              <p className="bible-yv-pick-discovery-hint bible-yv-muted" role="status">
                {contentError}
              </p>
            ) : showEmptyResults ? (
              <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">
                Aucun passage trouvé
              </p>
            ) : (
              <ul className="bible-yv-pick-verse-hits is-word-search-passages">
                {verseHits.map((hit) => (
                  <li key={hit.usfm}>
                    <button
                      type="button"
                      role="option"
                      className="bible-yv-pick-verse-hit"
                      onClick={() => handlePickVerse(hit)}
                    >
                      <span className="bible-yv-pick-verse-hit-ref">
                        {hit.bookTitle} {hit.chapter}.{hit.verse}
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
                ))}
              </ul>
            )}
          </div>
          <div className="bible-yv-passage-scroll-edge" aria-hidden />
        </>
      )}
    </div>
  );
}
