import { YvIcon } from "./YvIcon";
import type { DiscoveryBookHit, DiscoveryJump, PassageDiscoverySections } from "../bible/passageDiscovery/types";

type BiblePassageDiscoveryListProps = {
  sections: PassageDiscoverySections;
  jumps: DiscoveryJump[];
  busy: boolean;
  contentError: string | null;
  hasQuery: boolean;
  bookId: string;
  loading: boolean;
  onPickBook: (id: string) => void;
  onPickJump: (jump: DiscoveryJump) => void;
};

function renderBook(
  hit: DiscoveryBookHit,
  bookId: string,
  loading: boolean,
  onPickBook: (id: string) => void,
) {
  const on = hit.id.toUpperCase() === bookId.toUpperCase();
  const showCount = hit.count != null && hit.count > 0;
  return (
    <button
      key={hit.id}
      id={`bible-pick-book-${hit.id}`}
      type="button"
      role="option"
      aria-selected={on}
      className={`bible-yv-pick-cell is-book${on ? " is-on" : ""}`}
      onClick={() => onPickBook(hit.id)}
      disabled={loading}
    >
      <span className="bible-yv-pick-cell-label">{hit.title}</span>
      {showCount ? (
        <span
          className="bible-yv-pick-cell-count"
          aria-label={`${hit.count} occurrence${hit.count === 1 ? "" : "s"}`}
        >
          {hit.count}
        </span>
      ) : null}
    </button>
  );
}

function renderSection(
  label: string,
  hits: DiscoveryBookHit[],
  bookId: string,
  loading: boolean,
  onPickBook: (id: string) => void,
) {
  if (!hits.length) return null;
  return (
    <div className="bible-yv-pick-section" key={label}>
      <p className="bible-yv-pick-section-label" role="presentation">
        {label}
      </p>
      {hits.map((hit) => renderBook(hit, bookId, loading, onPickBook))}
    </div>
  );
}

export function BiblePassageDiscoveryList({
  sections,
  jumps,
  busy,
  contentError,
  hasQuery,
  bookId,
  loading,
  onPickBook,
  onPickJump,
}: BiblePassageDiscoveryListProps) {
  const totalBooks = sections.at.length + sections.nt.length;

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
        <p className="bible-yv-pick-discovery-busy bible-yv-muted" role="status">
          Recherche dans la Bible…
        </p>
      ) : null}

      {contentError && hasQuery && !jumps.length ? (
        <p className="bible-yv-pick-discovery-hint bible-yv-muted" role="status">
          {contentError}
        </p>
      ) : null}

      {totalBooks > 0 ? (
        <>
          {renderSection("Ancien Testament", sections.at, bookId, loading, onPickBook)}
          {renderSection("Nouveau Testament", sections.nt, bookId, loading, onPickBook)}
        </>
      ) : !busy && hasQuery && !jumps.length ? (
        <p className="bible-yv-pick-loading bible-yv-muted bible-yv-pick-roll-empty">
          Aucun livre trouvé
        </p>
      ) : null}
    </>
  );
}
