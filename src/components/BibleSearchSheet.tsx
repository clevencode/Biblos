import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { searchVerses, type BibleSearchHit } from "../youversion/client";
import {
  booksForSearchScope,
  CANON_BOOKS,
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
  if (scope === "all") return "Cherche un mot dans toute la Segond 21.";
  const title = bookTitle(bookId);
  if (title) return `Cherche dans ${title}.`;
  if (scope === "at") return "Choisis un livre de l’Ancien Testament.";
  if (scope === "nt") return "Choisis un livre du Nouveau Testament.";
  return "Choisis un livre, ou annule le filtre.";
}

export function BibleSearchSheet({ open, onClose, onSelect }: BibleSearchSheetProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [bookId, setBookId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<BibleSearchHit[]>([]);
  const reqGen = useRef(0);

  const filterActive = scope !== "all";
  const bookReady = scope === "all" || Boolean(bookId);
  const showBookList = filterActive && !bookId;
  const bookFilter = useMemo(
    () => (bookReady ? booksForSearchScope(scope, bookId) : null),
    [scope, bookId, bookReady],
  );
  const activeFilterLabel = bookId
    ? bookTitle(bookId)
    : testamentLabel(scope);

  const otBooks = useMemo(
    () => CANON_BOOKS.filter((book) => book.testament === "at"),
    [],
  );
  const ntBooks = useMemo(
    () => CANON_BOOKS.filter((book) => book.testament === "nt"),
    [],
  );
  const booksForPanel = scope === "nt" ? ntBooks : otBooks;

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
      if (filterActive) {
        event.preventDefault();
        clearFilter();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, filterActive, bookId]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2 || !bookReady) {
      setResults([]);
      setTotal(0);
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
          setBusy(false);
          return;
        }
        setResults(res.results ?? []);
        setTotal(res.total ?? res.results?.length ?? 0);
        setBusy(false);
        listRef.current?.scrollTo({ top: 0 });
      })();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, query, bookFilter, bookReady]);

  if (!open) return null;

  const trimmed = query.trim();
  const showHint = trimmed.length < 2;
  const waitingBook = filterActive && !bookId;
  const showEmpty =
    !busy && !showHint && !waitingBook && !error && results.length === 0;

  return (
    <div
      className="bible-search-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Rechercher"
    >
      <div className="bible-search-sheet-field">
        <div className="bible-search-sheet-input-wrap">
          <span className="bible-search-sheet-glyph" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="search"
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
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                onSelect(results[0]);
              }
            }}
          />
          {query ? (
            <button
              type="button"
              className="bible-search-sheet-clear"
              aria-label="Effacer la recherche"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M3.2 3.2l7.6 7.6M10.8 3.2l-7.6 7.6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : (
            <span className="bible-search-sheet-clear-spacer" aria-hidden />
          )}
        </div>
        <button
          type="button"
          className="bible-search-sheet-exit"
          onClick={onClose}
          aria-label="Fermer la recherche"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M3.2 3.2l7.6 7.6M10.8 3.2l-7.6 7.6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
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
                      : "Toucher pour annuler le filtre"
                    : undefined
                }
                onClick={() => toggleScope(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {filterActive ? (
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

        {showBookList ? (
          <div
            className="bible-search-book-panel"
            role="listbox"
            aria-label={
              scope === "nt"
                ? "Livres du Nouveau Testament"
                : "Livres de l’Ancien Testament"
            }
          >
            <div className="bible-search-book-section">
              <p className="bible-search-book-section-title">
                {testamentLabel(scope)}
              </p>
              <div className="bible-search-book-grid">
                {booksForPanel.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="bible-search-book-option"
                    onClick={() => pickBook(book.id)}
                  >
                    {book.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {!showBookList ? (
        <div className="bible-search-sheet-meta" aria-live="polite">
          {busy ? (
            <span>Recherche…</span>
          ) : showHint ? (
            <span>Tape un mot (ex. parole, grâce)</span>
          ) : error ? (
            <span className="bible-search-sheet-error">{error}</span>
          ) : (
            <span>
              {total} résultat{total === 1 ? "" : "s"}
              {total > results.length ? ` · ${results.length} affichés` : ""}
              {activeFilterLabel ? ` · ${activeFilterLabel}` : ""}
            </span>
          )}
        </div>
      ) : (
        <div className="bible-search-sheet-meta" aria-live="polite">
          <span>Choisis un livre pour lancer la recherche</span>
        </div>
      )}

      <ul
        ref={listRef}
        className="bible-search-sheet-list"
        role="listbox"
        aria-label="Résultats"
      >
        {!showBookList && (showHint || waitingBook) && !busy ? (
          <li className="bible-search-sheet-empty bible-search-sheet-hint">
            {scopeHint(scope, bookId)}
          </li>
        ) : null}
        {showEmpty ? (
          <li className="bible-search-sheet-empty">
            Aucun verset trouvé
            {activeFilterLabel ? ` dans ${activeFilterLabel}` : ""}.
            {filterActive ? (
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
          </li>
        ) : null}
        {!showBookList
          ? results.map((hit) => {
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
            })
          : null}
      </ul>
    </div>
  );
}
