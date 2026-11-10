import { Skeleton } from "../Skeleton";

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
      <Skeleton width={52} height={52} borderRadius={16} className="plan-card-skeleton-swatch" />
      <span className="plan-card-body">
        <Skeleton block height="0.85rem" width="72%" className="plan-card-skeleton-line plan-card-skeleton-line--title" />
        <Skeleton
          block
          height="0.72rem"
          width="48%"
          className="plan-card-skeleton-line plan-card-skeleton-line--meta"
          style={{ marginTop: 6 }}
        />
        {showProgress ? (
          <Skeleton block height={5} width="88%" borderRadius={999} className="plan-card-skeleton-progress" style={{ marginTop: 10 }} />
        ) : (
          <span className="plan-card-skeleton-progress plan-card-skeleton-progress--ghost" />
        )}
      </span>
      <Skeleton width="5.5rem" height="2rem" pill className="plan-card-skeleton-cta" style={{ marginTop: 2 }} />
    </article>
  );
}
