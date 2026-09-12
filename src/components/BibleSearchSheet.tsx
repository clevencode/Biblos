import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
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

type SearchScope = "all" | "at" | "nt" | "book";

const SCOPE_OPTIONS = [
  { id: "all", label: "Tous", short: "Tous" },
  { id: "at", label: "AT", short: "AT" },
  { id: "nt", label: "NT", short: "NT" },
  { id: "book", label: "Livre", short: "Livre" },
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

function scopeLabel(scope: SearchScope, bookId: string): string | null {
  if (scope === "at") return "Ancien Testament";
  if (scope === "nt") return "Nouveau Testament";
  if (scope === "book") {
    const book = CANON_BOOKS.find((item) => item.id === bookId);
    return book?.title ?? null;
  }
  return null;
}

function scopeHint(scope: SearchScope, bookId: string): string {
  if (scope === "at") return "Cherche dans l’Ancien Testament.";
  if (scope === "nt") return "Cherche dans le Nouveau Testament.";
  if (scope === "book") {
    const book = CANON_BOOKS.find((item) => item.id === bookId);
    return book
      ? `Cherche dans ${book.title}.`
      : "Choisis un livre, ou annule le filtre.";
  }
  return "Cherche un mot dans toute la Segond 21.";
}

export function BibleSearchSheet({ open, onClose, onSelect }: BibleSearchSheetProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const bookPickerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [bookId, setBookId] = useState("");
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<BibleSearchHit[]>([]);
  const reqGen = useRef(0);

  const filterActive = scope !== "all";
  const bookReady = scope !== "book" || Boolean(bookId);
  const bookFilter = useMemo(
    () => (bookReady ? booksForSearchScope(scope, bookId) : null),
    [scope, bookId, bookReady],
  );
  const activeFilterLabel = scopeLabel(scope, bookId);
  const selectedBook = CANON_BOOKS.find((book) => book.id === bookId) ?? null;

  const otBooks = useMemo(
    () => CANON_BOOKS.filter((book) => book.testament === "at"),
    [],
  );
  const ntBooks = useMemo(
    () => CANON_BOOKS.filter((book) => book.testament === "nt"),
    [],
  );

  function clearFilter() {
    setScope("all");
    setBookId("");
    setBookPickerOpen(false);
  }

  function toggleScope(next: SearchScope) {
    if (next === "all" || scope === next) {
      clearFilter();
      return;
    }
    setScope(next);
    if (next !== "book") {
      setBookId("");
      setBookPickerOpen(false);
    } else {
      setBookPickerOpen(true);
    }
  }

  function pickBook(id: string) {
    setBookId(id);
    setBookPickerOpen(false);
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
      if (bookPickerOpen) {
        event.preventDefault();
        setBookPickerOpen(false);
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
  }, [open, onClose, filterActive, bookPickerOpen]);

  useEffect(() => {
    if (!bookPickerOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (bookPickerRef.current?.contains(event.target as Node)) return;
      setBookPickerOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [bookPickerOpen]);

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
  const waitingBook = scope === "book" && !bookId;
  const showEmpty =
    !busy && !showHint && !waitingBook && !error && results.length === 0;

  return (
    <div
      className="bible-search-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="bible-search-sheet-head">
        <button
          type="button"
          className="bible-search-sheet-close"
          onClick={onClose}
          aria-label="Fermer la recherche"
        >
          ←
        </button>
        <p id={titleId} className="bible-search-sheet-title">
          Rechercher
        </p>
        <span className="bible-search-sheet-spacer" aria-hidden />
      </header>

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
              ×
            </button>
          ) : null}
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
                    ? "Toucher pour annuler le filtre"
                    : undefined
                }
                onClick={() => toggleScope(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {scope === "book" ? (
          <div className="bible-search-book-picker" ref={bookPickerRef}>
            <div className="bible-search-book-row">
              <button
                type="button"
                className={`bible-search-book-trigger${bookPickerOpen ? " is-open" : ""}${selectedBook ? " has-value" : ""}`}
                aria-haspopup="listbox"
                aria-expanded={bookPickerOpen}
                aria-label="Choisir un livre"
                onClick={() => setBookPickerOpen((value) => !value)}
              >
                <span className="bible-search-book-trigger-label">
                  {selectedBook ? selectedBook.title : "Choisir un livre…"}
                </span>
                <span className="bible-search-book-trigger-chevron" aria-hidden>
                  {bookPickerOpen ? "▴" : "▾"}
                </span>
              </button>
              {bookId ? (
                <button
                  type="button"
                  className="bible-search-book-clear"
                  aria-label="Effacer le livre"
                  onClick={() => {
                    setBookId("");
                    setBookPickerOpen(true);
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>

            {bookPickerOpen ? (
              <div
                className="bible-search-book-panel"
                role="listbox"
                aria-label="Livres de la Bible"
              >
                <div className="bible-search-book-section">
                  <p className="bible-search-book-section-title">
                    Ancien Testament
                  </p>
                  <div className="bible-search-book-grid">
                    {otBooks.map((book) => {
                      const on = book.id === bookId;
                      return (
                        <button
                          key={book.id}
                          type="button"
                          role="option"
                          aria-selected={on}
                          className={`bible-search-book-option${on ? " is-on" : ""}`}
                          onClick={() => pickBook(book.id)}
                        >
                          {book.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="bible-search-book-section">
                  <p className="bible-search-book-section-title">
                    Nouveau Testament
                  </p>
                  <div className="bible-search-book-grid">
                    {ntBooks.map((book) => {
                      const on = book.id === bookId;
                      return (
                        <button
                          key={book.id}
                          type="button"
                          role="option"
                          aria-selected={on}
                          className={`bible-search-book-option${on ? " is-on" : ""}`}
                          onClick={() => pickBook(book.id)}
                        >
                          {book.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {filterActive ? (
          <div className="bible-search-filter-chip">
            <span className="bible-search-filter-chip-text">
              Filtre · {activeFilterLabel ?? "Livre"}
            </span>
            <button
              type="button"
              className="bible-search-filter-chip-clear"
              onClick={clearFilter}
            >
              Annuler
            </button>
          </div>
        ) : null}
      </div>

      <div className="bible-search-sheet-meta" aria-live="polite">
        {busy ? (
          <span>Recherche…</span>
        ) : showHint ? (
          <span>Tape un mot (ex. parole, grâce)</span>
        ) : waitingBook ? (
          <span>Choisis un livre pour lancer la recherche</span>
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

      <ul
        ref={listRef}
        className="bible-search-sheet-list"
        role="listbox"
        aria-label="Résultats"
      >
        {(showHint || waitingBook) && !busy ? (
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
    </div>
  );
}
