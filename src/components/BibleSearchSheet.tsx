import { useEffect, useMemo, useRef, useState } from "react";
import { BibleSearchHighlight } from "./BibleSearchHighlight";
import { YvIcon } from "./YvIcon";
import type { BibleSearchHit } from "../youversion/client";
import { searchVersesForVersion } from "../bible/passageForVersion";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { passageJumpsFromQuery } from "../youversion/bibleRefs";
import {
  booksForSearchScope,
  CANON_BOOKS,
  type CanonBook,
} from "../youversion/canon";
import type { ParsedPassage } from "../youversion/usfm";

export type BibleSearchSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (hit: BibleSearchHit) => void;
  textVersion?: BibleTextVersionId;
};

type SearchScope = "all" | "at" | "nt";

const SCOPE_OPTIONS = [
  { id: "all", label: "Tous" },
  { id: "at", label: "AT" },
  { id: "nt", label: "NT" },
] as const;

function testamentLabel(scope: SearchScope): string | null {
  if (scope === "at") return "Ancien Testament";
  if (scope === "nt") return "Nouveau Testament";
  return null;
}

function bookTitle(bookId: string): string | null {
  const book = CANON_BOOKS.find((item) => item.id === bookId.toUpperCase());
  return book?.title ?? null;
}

function scopeHint(scope: SearchScope, bookId: string): string {
  if (bookId) {
    const title = bookTitle(bookId);
    return title
      ? `Cherche dans ${title}.`
      : "Cherche dans ce livre.";
  }
  if (scope === "all") return "Cherche un mot, une référence (Jean 3.16), ou choisis un livre.";
  if (scope === "at") return "Cherche dans l’Ancien Testament, ou choisis un livre.";
  if (scope === "nt") return "Cherche dans le Nouveau Testament, ou choisis un livre.";
  return "Cherche un mot, une référence, ou choisis un livre.";
}

function jumpLabel(jump: ParsedPassage): string {
  const book = bookTitle(jump.bookId) ?? jump.bookId;
  if (jump.verse == null) return `${book} ${jump.chapter}`;
  if (jump.verseEnd != null && jump.verseEnd !== jump.verse) {
    return `${book} ${jump.chapter}.${jump.verse}-${jump.verseEnd}`;
  }
  return `${book} ${jump.chapter}.${jump.verse}`;
}

function jumpToHit(jump: ParsedPassage): BibleSearchHit {
  return {
    usfm: jump.usfm,
    bookTitle: bookTitle(jump.bookId) ?? jump.bookId,
    chapter: jump.chapter,
    verse: jump.verse ?? 0,
    text: "",
    snippet: "",
  };
}

function booksInScope(scope: SearchScope): CanonBook[] {
  if (scope === "at") return CANON_BOOKS.filter((b) => b.testament === "at");
  if (scope === "nt") return CANON_BOOKS.filter((b) => b.testament === "nt");
  return CANON_BOOKS;
}

export function BibleSearchSheet({
  open,
  onClose,
  onSelect,
  textVersion = "s21",
}: BibleSearchSheetProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [bookId, setBookId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<BibleSearchHit[]>([]);
  const [bookCounts, setBookCounts] = useState<Record<string, number>>({});
  const reqGen = useRef(0);

  const showBookBrowser = !bookId;
  const bookFilter = useMemo(
    () => booksForSearchScope(scope, bookId || null),
    [scope, bookId],
  );
  const activeFilterLabel = bookId
    ? bookTitle(bookId)
    : testamentLabel(scope);
  const filterChipVisible = scope !== "all" || Boolean(bookId);

  const otBooks = useMemo(
    () => CANON_BOOKS.filter((book) => book.testament === "at"),
    [],
  );
  const ntBooks = useMemo(
    () => CANON_BOOKS.filter((book) => book.testament === "nt"),
    [],
  );
  const scopedBooks = useMemo(() => booksInScope(scope), [scope]);

  const trimmed = query.trim();
  const jumps = useMemo(() => passageJumpsFromQuery(trimmed), [trimmed]);
  const isJumpQuery = jumps.length > 0;
  const hasQuery = trimmed.length >= 2;
  const matchingBookIds = useMemo(() => {
    if (!hasQuery) return null;
    return new Set(
      Object.entries(bookCounts)
        .filter(([, n]) => n > 0)
        .map(([id]) => id.toUpperCase()),
    );
  }, [hasQuery, bookCounts]);

  function visibleBooks(books: CanonBook[]): CanonBook[] {
    if (!matchingBookIds) return books;
    return books.filter((book) => matchingBookIds.has(book.id.toUpperCase()));
  }

  const visibleOt = visibleBooks(otBooks);
  const visibleNt = visibleBooks(ntBooks);
  const visibleScoped = visibleBooks(scopedBooks);
  const booksWithHits = matchingBookIds?.size ?? 0;

  function clearFilter() {
    setScope("all");
    setBookId("");
  }

  function toggleScope(next: SearchScope) {
    if (next === "all") {
      clearFilter();
      return;
    }
    if (scope === next) {
      if (bookId) {
        setBookId("");
        return;
      }
      clearFilter();
      return;
    }
    setScope(next);
    setBookId("");
  }

  function pickBook(id: string) {
    setBookId(id);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
    void searchVersesForVersion(textVersion, "aa", 1);
    return () => window.clearTimeout(id);
  }, [open, textVersion]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (bookId) {
        event.preventDefault();
        setBookId("");
        return;
      }
      if (scope !== "all") {
        event.preventDefault();
        clearFilter();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, scope, bookId]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2 || passageJumpsFromQuery(q).length > 0) {
      setResults([]);
      setTotal(0);
      setBookCounts({});
      setError(null);
      setBusy(false);
      return;
    }
    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await searchVersesForVersion(textVersion, q, 40, { books: bookFilter });
        if (gen !== reqGen.current) return;
        if (!res.ok) {
          setError(res.error || "Recherche indisponible");
          setResults([]);
          setTotal(0);
          setBookCounts({});
          setBusy(false);
          return;
        }
        setResults(res.results ?? []);
        setTotal(res.total ?? res.results?.length ?? 0);
        const rawCounts = res.bookCounts ?? {};
        const normalized: Record<string, number> = {};
        for (const [id, n] of Object.entries(rawCounts)) {
          const key = String(id || "").toUpperCase();
          if (!key || !Number.isFinite(n)) continue;
          normalized[key] = Number(n);
        }
        setBookCounts(normalized);
        setBusy(false);
        if (bookId) {
          listRef.current?.scrollTo({ top: 0 });
        } else {
          panelRef.current?.scrollTo({ top: 0 });
        }
      })();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, query, bookFilter, bookId, textVersion]);

  if (!open) return null;

  const showHint = !hasQuery;
  const showEmptyVerses =
    !showBookBrowser &&
    !busy &&
    hasQuery &&
    !error &&
    results.length === 0;
  const showEmptyBooks =
    showBookBrowser &&
    !busy &&
    hasQuery &&
    !error &&
    booksWithHits === 0;

  function renderBookButton(book: CanonBook) {
    const count = bookCounts[book.id.toUpperCase()] ?? 0;
    const showCount = hasQuery && !busy;
    return (
      <button
        key={book.id}
        type="button"
        role="option"
        aria-selected={false}
        className="bible-search-book-option"
        onClick={() => pickBook(book.id)}
      >
        <span className="bible-search-book-option-title">{book.title}</span>
        {showCount ? (
          <span className="bible-search-book-option-count" aria-label={`${count} occurrence${count === 1 ? "" : "s"}`}>
            {count}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div
      className="bible-search-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Rechercher"
    >
      <div className="bible-search-sheet-field">
        <button
          type="button"
          className="bible-search-sheet-back"
          onClick={onClose}
          aria-label="Fermer la recherche"
        >
          <YvIcon name="chevron_left" className="bible-search-sheet-back-icon" />
        </button>
        <div className="bible-search-sheet-input-wrap">
          <span className="bible-search-sheet-glyph" aria-hidden>
            <YvIcon name="search" opsz={20} className="bible-search-sheet-search-icon" />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="bible-search-sheet-input"
            value={query}
            placeholder="Mot, expression ou référence…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label="Rechercher un mot ou une référence"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (jumps[0]) {
                event.preventDefault();
                onSelect(jumpToHit(jumps[0]));
                return;
              }
              if (!showBookBrowser && results[0]) {
                event.preventDefault();
                onSelect(results[0]);
              }
            }}
          />
        </div>
      </div>

      <div
        className="bible-search-filters"
        role="group"
        aria-label="Filtrer la recherche"
      >
        <div className="bible-search-scope" role="tablist" aria-label="Portée">
          {SCOPE_OPTIONS.map((item) => {
            const on = scope === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                className={`bible-search-scope-btn${on ? " is-on" : ""}`}
                aria-selected={on}
                aria-pressed={on}
                title={
                  on && item.id !== "all"
                    ? bookId
                      ? "Toucher pour changer de livre"
                      : "Toucher pour afficher tous les livres"
                    : item.id === "all"
                      ? "Tous les livres"
                      : undefined
                }
                onClick={() => toggleScope(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {filterChipVisible ? (
          <div className="bible-search-filter-chip">
            <span className="bible-search-filter-chip-text">
              Filtre · {activeFilterLabel ?? "Livre"}
            </span>
            <button
              type="button"
              className="bible-search-filter-chip-clear"
              onClick={() => {
                if (bookId) setBookId("");
                else clearFilter();
              }}
            >
              {bookId ? "Livres" : "Annuler"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="bible-search-sheet-meta" aria-live="polite">
        {busy ? (
          <span>Recherche…</span>
        ) : isJumpQuery ? (
          <span>
            {jumps.length === 1
              ? "Touche Entrée pour ouvrir le passage"
              : `${jumps.length} passages · Entrée ouvre le premier`}
          </span>
        ) : showHint ? (
          <span>
            {showBookBrowser
              ? scope === "all"
                ? "Tous les livres · mot ou référence (Jean 3.16)"
                : `Livres · ${testamentLabel(scope)}`
              : "Tape un mot (ex. parole, grâce)"}
          </span>
        ) : error ? (
          <span className="bible-search-sheet-error">{error}</span>
        ) : showBookBrowser ? (
          <span>
            {total} résultat{total === 1 ? "" : "s"}
            {booksWithHits > 0
              ? ` · ${booksWithHits} livre${booksWithHits === 1 ? "" : "s"}`
              : ""}
            {activeFilterLabel && scope !== "all" ? ` · ${activeFilterLabel}` : ""}
          </span>
        ) : (
          <span>
            {total} résultat{total === 1 ? "" : "s"}
            {total > results.length ? ` · ${results.length} affichés` : ""}
            {activeFilterLabel ? ` · ${activeFilterLabel}` : ""}
          </span>
        )}
      </div>

      {isJumpQuery ? (
        <ul
          className="bible-search-sheet-list"
          role="listbox"
          aria-label="Passages"
        >
          {jumps.map((jump, index) => {
            const label = jumpLabel(jump);
            return (
              <li key={jump.usfm}>
                <button
                  type="button"
                  className="bible-search-sheet-item bible-search-jump"
                  role="option"
                  aria-selected={index === 0}
                  onClick={() => onSelect(jumpToHit(jump))}
                >
                  <span className="bible-search-jump-kicker">
                    {index === 0 ? "Aller au passage" : "Ouvrir aussi"}
                  </span>
                  <span className="bible-search-sheet-ref">{label}</span>
                  <span className="bible-search-sheet-snippet">
                    {jump.verse == null
                      ? "Ouvre ce chapitre"
                      : "Ouvre ce verset dans la lecture"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : showBookBrowser ? (
        <div
          ref={panelRef}
          className="bible-search-book-panel bible-search-book-panel--main"
          role="listbox"
          aria-label={
            scope === "all"
              ? "Tous les livres"
              : scope === "nt"
                ? "Livres du Nouveau Testament"
                : "Livres de l’Ancien Testament"
          }
        >
          {showHint ? (
            <p className="bible-search-sheet-hint-inline muted">
              {scopeHint(scope, bookId)}
            </p>
          ) : null}
          {showEmptyBooks ? (
            <p className="bible-search-sheet-empty">
              Aucun verset trouvé
              {scope !== "all" && activeFilterLabel ? ` dans ${activeFilterLabel}` : ""}.
              {scope !== "all" ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="bible-search-empty-clear"
                    onClick={clearFilter}
                  >
                    Chercher partout
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
          {!showEmptyBooks && scope === "all" ? (
            <>
              {visibleOt.length > 0 ? (
                <div className="bible-search-book-section">
                  <p className="bible-search-book-section-title">Ancien Testament</p>
                  <div className="bible-search-book-grid">
                    {visibleOt.map(renderBookButton)}
                  </div>
                </div>
              ) : null}
              {visibleNt.length > 0 ? (
                <div className="bible-search-book-section">
                  <p className="bible-search-book-section-title">Nouveau Testament</p>
                  <div className="bible-search-book-grid">
                    {visibleNt.map(renderBookButton)}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {!showEmptyBooks && scope !== "all" && visibleScoped.length > 0 ? (
            <div className="bible-search-book-section">
              <p className="bible-search-book-section-title">
                {testamentLabel(scope)}
              </p>
              <div className="bible-search-book-grid">
                {visibleScoped.map(renderBookButton)}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <ul
          ref={listRef}
          className="bible-search-sheet-list"
          role="listbox"
          aria-label="Résultats"
        >
          {showHint && !busy ? (
            <li className="bible-search-sheet-empty bible-search-sheet-hint">
              {scopeHint(scope, bookId)}
            </li>
          ) : null}
          {showEmptyVerses ? (
            <li className="bible-search-sheet-empty">
              Aucun verset trouvé
              {activeFilterLabel ? ` dans ${activeFilterLabel}` : ""}.
              <button
                type="button"
                className="bible-search-empty-clear"
                onClick={() => setBookId("")}
              >
                Autres livres
              </button>
            </li>
          ) : null}
          {results.map((hit) => {
            const label = `${hit.bookTitle} ${hit.chapter}.${hit.verse}`;
            return (
              <li key={hit.usfm}>
                <button
                  type="button"
                  className="bible-search-sheet-item"
                  role="option"
                  onClick={() => onSelect(hit)}
                >
                  <span className="bible-search-sheet-ref">{label}</span>
                  <span className="bible-search-sheet-snippet">
                    <BibleSearchHighlight text={hit.snippet} query={trimmed} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
