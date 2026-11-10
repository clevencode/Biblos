import { Skeleton } from "../Skeleton";

type BiblePickerDiscoverySkeletonProps = {
  bookCells?: number;
};

/** Busca no picker — grelha de livros fantasma + mensagem. */
export function BiblePickerDiscoverySkeleton({ bookCells = 4 }: BiblePickerDiscoverySkeletonProps) {
  return (
    <div className="bible-yv-pick-discovery-skeleton" role="status" aria-busy="true">
      <p className="bible-yv-pick-discovery-busy bible-yv-muted">Recherche dans la Bible…</p>
      <div className="bible-yv-pick-grid is-books is-loading" aria-hidden>
        {Array.from({ length: bookCells }, (_, i) => (
          <div
            key={`skeleton-discovery-book:${i + 1}`}
            className="bible-yv-pick-cell is-book is-loading skeleton-picker-cell"
          >
            <span className="bible-yv-pick-cell-label is-opaque">Livre</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type BibleVerseHitSnippetSkeletonProps = {
  lines?: number;
};

export function BibleVerseHitSnippetSkeleton({ lines = 2 }: BibleVerseHitSnippetSkeletonProps) {
  return (
    <span className="bible-yv-pick-verse-hit-snippet is-loading-line" aria-hidden>
      <Skeleton block height="0.82rem" width={lines > 1 ? "94%" : "100%"} />
      {lines > 1 ? <Skeleton block height="0.82rem" width="72%" style={{ marginTop: 6 }} /> : null}
    </span>
  );
}
