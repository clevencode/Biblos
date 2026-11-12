import type { ReadingPlan } from "../domain/types";
import { isPlanComplete, loadPlanProgress, progressCounts } from "../domain/planProgress";

type PlanCardRowProps = {
  plan: ReadingPlan;
  onSelect: (plan: ReadingPlan) => void;
  /** Met en avant un plan déjà commencé. */
  emphasize?: boolean;
};

export function PlanCardRow({ plan, onSelect, emphasize = false }: PlanCardRowProps) {
  const progress = loadPlanProgress(plan.id);
  const { done, total } = progressCounts(plan, progress);
  const complete = isPlanComplete(plan, progress);
  const started = done > 0 || progress?.lastJour != null;
  const pct =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  const meta =
    total > 0
      ? `${done}/${total} jour${total > 1 ? "s" : ""}`
      : plan.totalDays > 0
        ? `${plan.totalDays} jour${plan.totalDays > 1 ? "s" : ""}`
        : null;

  const cta = !started ? "Commencer" : complete ? "Revoir" : "Continuer";

  return (
    <button
      type="button"
      className={`plan-card${emphasize || started ? " is-on" : ""}`}
      onClick={() => onSelect(plan)}
      aria-label={`${cta} : ${plan.title}`}
    >
      <span
        className="plan-card-swatch"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, var(--accent) 72%, var(--elevated)), color-mix(in srgb, var(--accent) 38%, var(--surface)))`,
        }}
        aria-hidden
      >
        <span className="plan-card-mark">
          {complete ? "✓" : started ? `${Math.max(1, done)}` : "→"}
        </span>
      </span>
      <span className="plan-card-body">
        <h3 className="plan-card-title type-headline">{plan.title}</h3>
        {meta ? (
          <p className="plan-card-meta type-label muted">{meta}</p>
        ) : null}
        {started && total > 0 ? (
          <span
            className="plan-card-progress"
            aria-hidden="true"
          >
            <span className="plan-card-progress-track">
              <span
                className="plan-card-progress-fill"
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
        ) : null}
        {plan.description ? (
          <p className="plan-card-desc type-caption muted">{plan.description}</p>
        ) : null}
      </span>
      <span className="plan-card-cta type-label" aria-hidden="true">
        {cta}
        <span className="plan-card-cta-icon">→</span>
      </span>
    </button>
  );
}
