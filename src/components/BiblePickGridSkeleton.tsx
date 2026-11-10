import type { GridSkeletonSchema } from "../bible/viewState/pickerViewState";

type BiblePickGridSkeletonProps = {
  count?: number;
  from?: number;
  slotIds?: readonly string[];
  schema?: GridSkeletonSchema;
  className?: string;
  role?: string;
  "aria-label"?: string;
};

/** Grille chapitre/verset — numéros opaques, hauteur stable (pas d’effondrement du panneau). */
export function BiblePickGridSkeleton({
  count = 24,
  from = 1,
  slotIds,
  schema,
  className = "",
  role,
  "aria-label": ariaLabel,
}: BiblePickGridSkeletonProps) {
  const ids =
    schema?.slotIds ??
    slotIds ??
    Array.from({ length: Math.max(1, Math.min(count, 60)) }, (_, i) => `pick-skel:${from + i}`);
  const labels = ids.map((_, i) => String(from + i));
  return (
    <>
      {ids.map((id, i) => (
        <div
          key={id}
          className={`bible-yv-pick-cell is-loading skeleton-picker-cell${className ? ` ${className}` : ""}`}
          role={role}
          aria-hidden={role ? undefined : true}
          aria-label={ariaLabel}
        >
          {labels[i]}
        </div>
      ))}
    </>
  );
}
