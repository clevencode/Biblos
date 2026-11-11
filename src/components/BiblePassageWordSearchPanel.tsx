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
 * Painel de busca — pills + gaveta multi-livros + RÉCENTS.
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
  const [isBookPickerOpen, setIsBookPickerOpen] = useState(false);
  const [draftBookIds, setDraftBookIds] = useState<string[]>([]);
  const [bookFilterQuery, setBookFilterQuery] = useState("");

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
  const booksActive = scopeFilter === "books" && selectedBookIds.length > 0;

  const loadedLimit = Math.max(verseHits.length, HIT_LIMIT);
  const booksSignature = useMemo(() => {
    if (booksActive) {
      return `books:${[...selectedBookIds].sort().join(",")}`;
    }
    if (scopeFilter === "nt" || scopeFilter === "ot") return scopeFilter;
    return "all";
  }, [booksActive, selectedBookIds, scopeFilter]);

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
    return CANON_BOOKS.filter((book) => (byBook[book.id.toUpperCase()] ?? 0) > 0);
  }, [byBook]);

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

  const bookPillLabel = useMemo(() => {
    const ids = selectedBookIds;
    const countFor = (list: string[]) =>
      list.reduce((sum, id) => {
        const key = resolveCanonicalBookId(id);
        return sum + (byBook[key] ?? 0);
      }, 0);
    const titleOf = (id: string) => {
      const key = resolveCanonicalBookId(id);
      return (
        CANON_BOOKS.find((b) => b.id.toUpperCase() === key)?.title ??
        (key === readerBookId ? bookLabel : key || id)
      );
    };

    if (ids.length === 0) {
      const n = readerBookId ? byBook[readerBookId] ?? 0 : 0;
      return hasActiveQuery && n > 0 ? `${bookLabel} (${n})` : bookLabel;
    }
    if (ids.length === 1) {
      const n = countFor(ids);
      return hasActiveQuery ? `${titleOf(ids[0]!)} (${n})` : titleOf(ids[0]!);
    }
    if (ids.length === 2) {
      const n = countFor(ids);
      const label = `${titleOf(ids[0]!)}, ${titleOf(ids[1]!)}`;
      return hasActiveQuery ? `${label} (${n})` : label;
    }
    const n = countFor(ids);
    return hasActiveQuery
      ? `${ids.length} livres (${n})`
      : `${ids.length} livres`;
  }, [selectedBookIds, byBook, readerBookId, bookLabel, hasActiveQuery]);

  useEffect(() => {
    if (!open) {
      setIsBookPickerOpen(false);
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

  function seedDraftBookIds(): string[] {
    if (selectedBookIds.length > 0) {
      return selectedBookIds
        .map((id) => resolveCanonicalBookId(id))
        .filter(Boolean);
    }
    return readerBookId ? [readerBookId] : [];
  }

  function openBookPicker() {
    setDraftBookIds(seedDraftBookIds());
    setBookFilterQuery("");
    setIsBookPickerOpen(true);
  }

  function closeBookPicker() {
    setIsBookPickerOpen(false);
    setBookFilterQuery("");
  }

  function toggleBookPicker() {
    if (isBookPickerOpen) {
      closeBookPicker();
      return;
    }
    openBookPicker();
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

  function handleTestamentPill(next: "nt" | "ot") {
    closeBookPicker();
    resetScroll();
    onScopeFilterChange(next);
  }

  /** 1º toque: reativa histórico ou liga o livro atual. 2º toque: abre a gaveta. */
  function handleBooksPillTap() {
    if (!booksActive) {
      resetScroll();
      if (selectedBookIds.length > 0) {
        onSelectedBookIdsChange(selectedBookIds);
        return;
      }
      if (!readerBookId) return;
      onSelectedBookIdsChange([readerBookId]);
      return;
    }
    toggleBookPicker();
  }

  /** Seta: abre a gaveta (restaura histórico ou pré-marca o livro atual). */
  function handleBooksChevron(event: MouseEvent) {
    event.stopPropagation();
    if (!booksActive) {
      resetScroll();
      if (selectedBookIds.length > 0) {
        onSelectedBookIdsChange(selectedBookIds);
      } else if (readerBookId) {
        onSelectedBookIdsChange([readerBookId]);
      }
    }
    toggleBookPicker();
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
      onScopeFilterChange("all");
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
          aria-selected={booksActive}
          aria-expanded={isBookPickerOpen}
          className={`bible-yv-word-search-pill bible-yv-word-search-pill--books${
            booksActive ? " is-on" : ""
          }`}
          onClick={handleBooksPillTap}
        >
          <span className="bible-yv-word-search-pill-books-label">{bookPillLabel}</span>
          <span
            className="bible-yv-word-search-pill-chevron"
            onClick={handleBooksChevron}
            role="presentation"
          >
            ▾
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scopeFilter === "nt"}
          className={`bible-yv-word-search-pill${scopeFilter === "nt" ? " is-on" : ""}`}
          onClick={() => handleTestamentPill("nt")}
        >
          {countLabel("nt")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scopeFilter === "ot"}
          className={`bible-yv-word-search-pill${scopeFilter === "ot" ? " is-on" : ""}`}
          onClick={() => handleTestamentPill("ot")}
        >
          {countLabel("ot")}
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
                : `Tout afficher (${facets?.total ?? 0})`}
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
