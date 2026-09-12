import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { searchVerses, type BibleSearchHit } from "../youversion/client";

export type BibleSearchSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (hit: BibleSearchHit) => void;
};

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
    // Avancer dans le texte brut jusqu'à couvrir `at` chars normalisés.
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

export function BibleSearchSheet({ open, onClose, onSelect }: BibleSearchSheetProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<BibleSearchHit[]>([]);
  const reqGen = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
    // Précharge l'index serveur (1ʳᵉ recherche plus rapide).
    void searchVerses("aa", 1);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
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
        const res = await searchVerses(q, 40);
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
  }, [open, query]);

  if (!open) return null;

  const trimmed = query.trim();
  const showHint = trimmed.length < 2;
  const showEmpty = !busy && !showHint && !error && results.length === 0;

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
          ↓
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
              aria-label="Effacer"
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
          </span>
        )}
      </div>

      <ul
        ref={listRef}
        className="bible-search-sheet-list"
        role="listbox"
        aria-label="Résultats"
      >
        {showHint && !busy ? (
          <li className="bible-search-sheet-empty bible-search-sheet-hint">
            Cherche un mot dans toute la Segond 21.
          </li>
        ) : null}
        {showEmpty ? (
          <li className="bible-search-sheet-empty">Aucun verset trouvé.</li>
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
