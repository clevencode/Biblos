import type { ReadingPlan } from "../domain/types";

type PlanCardRowProps = {
  plan: ReadingPlan;
  onSelect: (plan: ReadingPlan) => void;
};

export function PlanCardRow({ plan, onSelect }: PlanCardRowProps) {
  const meta =
    plan.totalDays > 0
      ? `${plan.totalDays} jour${plan.totalDays > 1 ? "s" : ""}`
      : null;

  return (
    <article className="plan-card">
      <span
        className="plan-card-swatch"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, var(--accent) 55%, #3b82f6), color-mix(in srgb, var(--accent) 25%, #6366f1))`,
        }}
        aria-hidden
      />
      <span className="plan-card-body">
        <h3 className="plan-card-title type-headline">{plan.title}</h3>
        {meta ? (
          <p className="plan-card-meta type-label muted">{meta}</p>
        ) : null}
        {plan.description ? (
          <p className="plan-card-desc type-caption muted">{plan.description}</p>
        ) : null}
      </span>
      <button
        type="button"
        className="plan-card-cta type-label"
        onClick={() => onSelect(plan)}
      >
        Ouvrir
      </button>
    </article>
  );
}
