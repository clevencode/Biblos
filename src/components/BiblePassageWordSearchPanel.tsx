import { useLayoutEffect, useRef } from "react";
import type { PassageDiscoverySession } from "../bible/passageDiscovery/session";
import type { PassageDiscoveryResult, DiscoveryJump } from "../bible/passageDiscovery/types";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import type { BibleSearchHit } from "../youversion/client";
import { YvIcon } from "./YvIcon";
import { BiblePassageDiscoveryList } from "./BiblePassageDiscoveryList";

type BiblePassageWordSearchPanelProps = {
  id: string;
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onQueryClear: () => void;
  discovery: PassageDiscoveryResult;
  discoveryBusy: boolean;
  textVersion: BibleTextVersionId;
  bookId: string;
  loading: boolean;
  discoverySession: PassageDiscoverySession;
  onDiscoveryListScroll: (scrollTop: number) => void;
  onDiscoveryExpandedBookChange: (bookId: string | null) => void;
  onDiscoveryVerseListScroll: (bookId: string, scrollTop: number) => void;
  onPickJump: (jump: DiscoveryJump) => void;
  onPickVerse: (hit: BibleSearchHit) => void;
  onPickBook: (id: string) => void;
};

export function BiblePassageWordSearchPanel({
  id: panelId,
  open,
  query,
  onQueryChange,
  onQueryClear,
  discovery,
  discoveryBusy,
  textVersion,
  bookId,
  loading,
  discoverySession,
  onDiscoveryListScroll,
  onDiscoveryExpandedBookChange,
  onDiscoveryVerseListScroll,
  onPickJump,
  onPickVerse,
  onPickBook,
}: BiblePassageWordSearchPanelProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const restoredListScrollRef = useRef(false);
  const hasQuery = Boolean(query.trim());

  useLayoutEffect(() => {
    if (!open) {
      restoredListScrollRef.current = false;
      return;
    }
    if (restoredListScrollRef.current) return;
    const el = gridRef.current;
    if (!el) return;
    el.scrollTop = discoverySession.listScrollTop;
    restoredListScrollRef.current = true;
  }, [open, discoverySession.listScrollTop]);

  if (!open) return null;

  function handlePickVerse(hit: BibleSearchHit) {
    if (gridRef.current) {
      onDiscoveryListScroll(gridRef.current.scrollTop);
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
        {hasQuery ? (
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
      <div
        ref={gridRef}
        className="bible-yv-pick-grid is-books"
        role="listbox"
        onScroll={(event) => onDiscoveryListScroll(event.currentTarget.scrollTop)}
      >
        <BiblePassageDiscoveryList
          sections={discovery.sections}
          jumps={discovery.jumps}
          busy={discoveryBusy}
          contentError={discovery.contentError}
          textVersion={textVersion}
          hasQuery={hasQuery}
          searchQuery={query}
          bookId={bookId}
          loading={loading}
          expandedBookId={discoverySession.expandedBookId}
          anchorVerseUsfm={discoverySession.anchorVerseUsfm}
          verseScrollByBook={discoverySession.verseScrollByBook}
          verseDiscoveryEnabled
          onExpandedBookChange={onDiscoveryExpandedBookChange}
          onVerseListScroll={onDiscoveryVerseListScroll}
          onPickBook={onPickBook}
          onPickJump={onPickJump}
          onPickVerse={handlePickVerse}
        />
      </div>
      <div className="bible-yv-passage-scroll-edge" aria-hidden />
    </div>
  );
}
