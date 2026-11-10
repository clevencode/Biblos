/** Morfologia fantasma da linha `plan-card` — dimensões idênticas, sem dados. */

const DEFAULT_ROWS = 4;

type PlanGallerySkeletonProps = {
  rows?: number;
};

export function PlanGallerySkeleton({ rows = DEFAULT_ROWS }: PlanGallerySkeletonProps) {
  const slotIds = Array.from({ length: rows }, (_, i) => `plan-skeleton-${i + 1}`);
  return (
    <div
      className="plan-discover-grid plan-discover-grid--skeleton"
      role="status"
      aria-busy="true"
      aria-label="Chargement des plans"
    >
      {slotIds.map((id, index) => (
        <PlanSkeletonRow key={id} showProgress={index % 3 !== 2} />
      ))}
    </div>
  );
}

function PlanSkeletonRow({ showProgress }: { showProgress: boolean }) {
  return (
    <article className="plan-card plan-card--skeleton" aria-hidden="true">
      <span className="plan-card-skeleton-swatch" />
      <span className="plan-card-body">
        <span className="plan-card-skeleton-line plan-card-skeleton-line--title" />
        <span className="plan-card-skeleton-line plan-card-skeleton-line--meta" />
        {showProgress ? (
          <span className="plan-card-skeleton-progress" />
        ) : (
          <span className="plan-card-skeleton-progress plan-card-skeleton-progress--ghost" />
        )}
      </span>
      <span className="plan-card-skeleton-cta" />
    </article>
  );
}
