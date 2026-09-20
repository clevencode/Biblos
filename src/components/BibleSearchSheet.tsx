import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { YvIcon } from "./YvIcon";
import { searchVerses, type BibleSearchHit } from "../youversion/client";
import {
  booksForSearchScope,
  CANON_BOOKS,
  type CanonBook,
} from "../youversion/canon";

export type BibleSearchSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (hit: BibleSearchHit) => void;
};

type SearchScope = "all" | "at" | "nt";

const SCOPE_OPTIONS = [
  { id: "all", label: "Tous" },
  { id: "at", label: "AT" },
  { id: "nt", label: "NT" },
] as const;

function normalizeForHighlight(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Surligne le match même si accents / casse diffèrent (être ↔ etre). */
function HighlightSnippet({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const normQ = normalizeForHighlight(q);
  if (normQ.length < 2) return <>{text}</>;

  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const restNorm = normalizeForHighlight(rest);
    const at = restNorm.indexOf(normQ);
    if (at < 0) {
      nodes.push(<span key={key++}>{rest}</span>);
      break;
    }
    let rawStart = 0;
    let normCount = 0;
    while (rawStart < rest.length && normCount < at) {
      const ch = rest[rawStart]!;
      const n = normalizeForHighlight(ch);
      if (n) normCount += n.length;
      rawStart += 1;
    }
    let rawEnd = rawStart;
    let matched = 0;
    while (rawEnd < rest.length && matched < normQ.length) {
      const ch = rest[rawEnd]!;
      const n = normalizeForHighlight(ch);
      if (n) matched += n.length;
      rawEnd += 1;
    }
    if (rawStart > 0) {
      nodes.push(<span key={key++}>{rest.slice(0, rawStart)}</span>);
    }
    nodes.push(
      <mark key={key++} className="bible-search-mark">
        {rest.slice(rawStart, rawEnd)}
      </mark>,
    );
    i += rawEnd;
  }
  return <>{nodes}</>;
}

function testamentLabel(scope: SearchScope): string | null {
  if (scope === "at") return "Ancien Testament";
  if (scope === "nt") return "Nouveau Testament";
  return null;
}

function bookTitle(bookId: string): string | null {
  const book = CANON_BOOKS.find((item) => item.id === bookId);
  return book?.title ?? null;
}

function scopeHint(scope: SearchScope, bookId: string): string {
  if (bookId) {
    const title = bookTitle(bookId);
    return title
      ? `Cherche dans ${title}.`
      : "Cherche dans ce livre.";
  }
  if (scope === "all") return "Cherche un mot, ou choisis un livre.";
  if (scope === "at") return "Cherche dans l’Ancien Testament, ou choisis un livre.";
  if (scope === "nt") return "Cherche dans le Nouveau Testament, ou choisis un livre.";
  return "Cherche un mot ou choisis un livre.";
}

function booksInScope(scope: SearchScope): CanonBook[] {
  if (scope === "at") return CANON_BOOKS.filter((b) => b.testament === "at");
  if (scope === "nt") return CANON_BOOKS.filter((b) => b.testament === "nt");
  return CANON_BOOKS;
}

export function BibleSearchSheet({ open, onClose, onSelect }: BibleSearchSheetProps) {
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
    void searchVerses("aa", 1);
    return () => window.clearTimeout(id);
  }, [open]);

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
    if (q.length < 2) {
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
        const res = await searchVerses(q, 40, { books: bookFilter });
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
  }, [open, query, bookFilter, bookId]);

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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            className="bible-search-sheet-input"
            value={query}
            placeholder="Mot ou expression…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label="Rechercher un mot"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !showBookBrowser && results[0]) {
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
        ) : showHint ? (
          <span>
            {showBookBrowser
              ? scope === "all"
                ? "Tous les livres · tape un mot pour compter"
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

      {showBookBrowser ? (
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
                    <HighlightSnippet text={hit.snippet} query={trimmed} />
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
