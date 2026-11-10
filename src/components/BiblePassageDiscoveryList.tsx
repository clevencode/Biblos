import { YvIcon } from "./YvIcon";
import type { DiscoveryJump, PassageDiscoverySections } from "../bible/passageDiscovery/types";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import type { BibleSearchHit } from "../youversion/client";
import { BiblePassageDiscoveryBookRow } from "./BiblePassageDiscoveryBookRow";
import { BiblePickerDiscoverySkeleton } from "../skeleton";
import type { DiscoveryBookHit } from "../bible/passageDiscovery/types";

type BiblePassageDiscoveryListProps = {
  sections: PassageDiscoverySections;
  jumps: DiscoveryJump[];
  busy: boolean;
  contentError: string | null;
  textVersion: BibleTextVersionId;
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
  /** `false` no passo livro (só títulos) — default `true`. */
  verseDiscoveryEnabled?: boolean;
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
          textVersion={props.textVersion}
          currentBookId={props.bookId}
          loading={props.loading}
          expanded={props.expandedBookId?.toUpperCase() === hit.id.toUpperCase()}
          anchorVerseUsfm={props.anchorVerseUsfm}
          verseScrollTop={props.verseScrollByBook[hit.id.toUpperCase()] ?? 0}
          verseDiscoveryEnabled={props.verseDiscoveryEnabled ?? true}
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
  textVersion,
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
  verseDiscoveryEnabled = true,
}: BiblePassageDiscoveryListProps) {
  const totalBooks = sections.at.length + sections.nt.length;

  const sectionProps = {
    searchQuery,
    hasQuery,
    textVersion,
    bookId,
    loading,
    expandedBookId,
    anchorVerseUsfm,
    verseScrollByBook,
    verseDiscoveryEnabled,
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

      {busy && hasQuery ? <BiblePickerDiscoverySkeleton /> : null}

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
