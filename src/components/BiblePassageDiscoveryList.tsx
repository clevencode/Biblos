import { YvIcon } from "./YvIcon";
import type { DiscoveryJump, PassageDiscoverySections } from "../bible/passageDiscovery/types";
import type { BibleSearchHit } from "../youversion/client";
import { BiblePassageDiscoveryBookRow } from "./BiblePassageDiscoveryBookRow";
import type { DiscoveryBookHit } from "../bible/passageDiscovery/types";

type BiblePassageDiscoveryListProps = {
  sections: PassageDiscoverySections;
  jumps: DiscoveryJump[];
  busy: boolean;
  contentError: string | null;
  hasQuery: boolean;
  searchQuery: string;
  bookId: string;
  loading: boolean;
  expandedBookId: string | null;
  anchorVerseUsfm: string | null;
  verseScrollByBook: Record<string, number>;
  onExpandedBookChange: (id: string | null) => void;
  onVerseListScroll: (bookId: string, scrollTop: number) => void;
  onPickBook: (id: string) => void;
  onPickJump: (jump: DiscoveryJump) => void;
  onPickVerse: (hit: BibleSearchHit) => void;
};

function renderSection(
  label: string,
  hits: DiscoveryBookHit[],
  props: Omit<
    BiblePassageDiscoveryListProps,
    "sections" | "jumps" | "busy" | "contentError"
  >,
) {
  if (!hits.length) return null;
  return (
    <div className="bible-yv-pick-section" key={label}>
      <p className="bible-yv-pick-section-label" role="presentation">
        {label}
      </p>
      {hits.map((hit) => (
        <BiblePassageDiscoveryBookRow
          key={hit.id}
          hit={hit}
          searchQuery={props.searchQuery}
          hasQuery={props.hasQuery}
          currentBookId={props.bookId}
          loading={props.loading}
          expanded={props.expandedBookId?.toUpperCase() === hit.id.toUpperCase()}
          anchorVerseUsfm={props.anchorVerseUsfm}
          verseScrollTop={props.verseScrollByBook[hit.id.toUpperCase()] ?? 0}
          onToggleExpand={props.onExpandedBookChange}
          onVerseListScroll={props.onVerseListScroll}
          onPickBook={props.onPickBook}
          onPickVerse={props.onPickVerse}
        />
      ))}
    </div>
  );
}

export function BiblePassageDiscoveryList({
  sections,
  jumps,
  busy,
  contentError,
  hasQuery,
  searchQuery,
  bookId,
  loading,
  expandedBookId,
  anchorVerseUsfm,
  verseScrollByBook,
  onExpandedBookChange,
  onVerseListScroll,
  onPickBook,
  onPickJump,
  onPickVerse,
}: BiblePassageDiscoveryListProps) {
  const totalBooks = sections.at.length + sections.nt.length;

  const sectionProps = {
    searchQuery,
    hasQuery,
    bookId,
    loading,
    expandedBookId,
    anchorVerseUsfm,
    verseScrollByBook,
    onExpandedBookChange,
    onVerseListScroll,
    onPickBook,
    onPickJump,
    onPickVerse,
  };

  return (
    <>
      {jumps.length ? (
        <div className="bible-yv-pick-jumps" role="group" aria-label="Références">
          {jumps.map((jump) => (
            <button
              key={jump.passage.usfm}
              type="button"
              className="bible-yv-pick-jump"
              onClick={() => onPickJump(jump)}
              disabled={loading}
            >
              <YvIcon name="menu_book" opsz={20} className="bible-yv-pick-jump-icon" />
              <span className="bible-yv-pick-jump-label">Aller à {jump.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {busy && hasQuery ? (
        <div className="bible-yv-pick-discovery-skeleton" role="status" aria-busy="true">
          <p className="bible-yv-pick-discovery-busy bible-yv-muted">
            Recherche dans la Bible…
          </p>
          <div className="bible-yv-pick-grid is-books is-loading" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="bible-yv-pick-cell is-book is-loading">
                <span className="bible-yv-pick-cell-label is-opaque">Livre</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {contentError && hasQuery && !jumps.length ? (
        <p className="bible-yv-pick-discovery-hint bible-yv-muted" role="status">
          {contentError}
        </p>
      ) : null}

      {totalBooks > 0 ? (
        <>
          {renderSection("Ancien Testament", sections.at, sectionProps)}
          {renderSection("Nouveau Testament", sections.nt, sectionProps)}
        </>
      ) : !busy && hasQuery && !jumps.length ? (
        <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">
          Aucun livre trouvé
        </p>
      ) : null}
    </>
  );
}
