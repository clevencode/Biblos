import { PlanGallerySkeleton } from "../../../skeleton/presets/PlanGallerySkeleton";

/** CLS : mesma grelha que `plan-discover-grid` (4 linhas). */
export function PlanDiscoverSkeleton() {
  return (
    <div className="plan-discover-surface plan-discover-surface--skeleton" aria-hidden>
      <PlanGallerySkeleton rows={4} />
    </div>
  );
}
