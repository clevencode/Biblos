type BiblePickGridSkeletonProps = {
  count: number;
  from?: number;
  className?: string;
  role?: string;
  "aria-label"?: string;
};

/** Grille chapitre/verset — numéros opaques, hauteur stable (pas d’effondrement du panneau). */
export function BiblePickGridSkeleton({
  count,
  from = 1,
  className = "",
  role,
  "aria-label": ariaLabel,
}: BiblePickGridSkeletonProps) {
  const n = Math.max(1, Math.min(count, 60));
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const label = String(from + i);
        return (
          <div
            key={label}
            className={`bible-yv-pick-cell is-loading${className ? ` ${className}` : ""}`}
            role={role}
            aria-hidden={role ? undefined : true}
            aria-label={ariaLabel}
          >
            {label}
          </div>
        );
      })}
    </>
  );
}
