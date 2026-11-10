import { useEffect, useLayoutEffect, useRef } from "react";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import type { BibleSearchHit } from "../youversion/client";
import { YvIcon } from "./YvIcon";
import { BibleSearchHighlight } from "./BibleSearchHighlight";
import { WordSearchSkeleton } from "./WordSearchSkeleton";

const MIN_WORD_CHARS = 2;

type BiblePassageWordSearchPanelProps = {
  id: string;
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onQueryClear: () => void;
  discoveryBusy: boolean;
  verseHits: BibleSearchHit[];
  verseTotal: number;
  contentError: string | null;
  textVersion: BibleTextVersionId;
  listScrollTop: number;
  onListScroll: (scrollTop: number) => void;
  onPickVerse: (hit: BibleSearchHit) => void;
};

/**
 * Painel de pesquisa por palavras — mesma lógica da barra unificada antiga:
 * digitar ≥ 2 chars → debounce → lista de **passagens** (ref + snippet).
 */
export function BiblePassageWordSearchPanel({
  id: panelId,
  open,
  query,
  onQueryChange,
  onQueryClear,
  discoveryBusy,
  verseHits,
  verseTotal,
  contentError,
  listScrollTop,
  onListScroll,
  onPickVerse,
}: BiblePassageWordSearchPanelProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoredListScrollRef = useRef(false);
  const trimmed = query.trim();
  const hasActiveQuery = trimmed.length >= MIN_WORD_CHARS;
  const showEmptyHint = !hasActiveQuery;
  const showSkeleton = discoveryBusy && hasActiveQuery;
  const showEmptyResults =
    hasActiveQuery && !discoveryBusy && !contentError && verseHits.length === 0;

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      restoredListScrollRef.current = false;
      return;
    }
    if (!hasActiveQuery || restoredListScrollRef.current) return;
    const el = gridRef.current;
    if (!el) return;
    el.scrollTop = listScrollTop;
    restoredListScrollRef.current = true;
  }, [open, hasActiveQuery, listScrollTop]);

  if (!open) return null;

  function handlePickVerse(hit: BibleSearchHit) {
    if (gridRef.current) {
      onListScroll(gridRef.current.scrollTop);
    }
    onPickVerse(hit);
  }

  return (
    <div
      id={panelId}
      className="bible-yv-passage-word-search-panel is-open"
      role="dialog"
      aria-modal="false"
      aria-label="Recherche dans la Bible"
    >
      <div className="bible-yv-pick-roll-search">
        <YvIcon name="search" opsz={20} className="bible-yv-pick-roll-search-icon" />
        <input
          ref={inputRef}
          type="search"
          className="bible-yv-pick-search"
          value={query}
          placeholder="Mot ou expression…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label="Rechercher un mot ou une expression dans la Bible"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {trimmed ? (
          <button
            type="button"
            className="bible-yv-pick-search-clear"
            onClick={onQueryClear}
            aria-label="Effacer la recherche"
          >
            <YvIcon name="close" opsz={20} className="bible-yv-pick-search-clear-icon" />
          </button>
        ) : null}
      </div>

      {!showEmptyHint && !showSkeleton && verseHits.length > 0 ? (
        <p className="bible-yv-word-search-meta bible-yv-muted" aria-live="polite">
          {verseTotal > verseHits.length
            ? `${verseHits.length} sur ${verseTotal} passages`
            : `${verseHits.length} passage${verseHits.length === 1 ? "" : "s"}`}
        </p>
      ) : null}

      <div
        ref={gridRef}
        className="bible-yv-pick-grid is-word-search"
        role="listbox"
        aria-label="Passages"
        onScroll={(event) => onListScroll(event.currentTarget.scrollTop)}
      >
        {showEmptyHint ? (
          <p className="bible-yv-word-search-empty bible-yv-muted" role="status">
            Saisir un mot ou une expression…
          </p>
        ) : showSkeleton ? (
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
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="bible-yv-passage-scroll-edge" aria-hidden />
    </div>
  );
}
