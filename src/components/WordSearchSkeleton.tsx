/**
 * Placeholder de linhas do painel de palavras — mesma altura visual que
 * `BiblePassageDiscoveryBookRow` (célula livro), para CLS zero durante debounce/API.
 */
type WordSearchSkeletonProps = {
  rows?: number;
};

export function WordSearchSkeleton({ rows = 6 }: WordSearchSkeletonProps) {
  return (
    <div
      className="bible-yv-word-search-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Recherche en cours"
    >
      <p className="bible-yv-pick-discovery-busy bible-yv-muted">Recherche dans la Bible…</p>
      <div className="bible-yv-word-search-skeleton-rows" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={`word-search-skel:${i + 1}`}
            className="bible-yv-word-search-skeleton-row"
          >
            <span className="bible-yv-word-search-skeleton-label" />
            <span className="bible-yv-word-search-skeleton-meta" />
          </div>
        ))}
      </div>
    </div>
  );
}
