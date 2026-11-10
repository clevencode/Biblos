import { YvIcon } from "./YvIcon";
import { planCoverStyle, planTitle } from "../planTheme";
import type { ReadingPlan } from "../types";

export type PlanGalleryPlanRowProps = {
  id?: string;
  plan: ReadingPlan;
  active: boolean;
  current: boolean;
  done: number;
  total: number;
  onActivate: () => void;
  onPick: () => void;
};

/** Linha de plano — só apresentação (sem fetch, sem loading). */
export function PlanGalleryPlanRow({
  id,
  plan,
  active,
  current,
  done,
  total,
  onActivate,
  onPick,
}: PlanGalleryPlanRowProps) {
  const title = planTitle(plan);
  const started = done > 0;
  const complete = total > 0 && done >= total;
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const action = complete ? "Terminé" : started ? "Continuer" : "Commencer";
  const metaParts = [
    total ? `${total} jour${total === 1 ? "" : "s"}` : null,
    started && !complete ? `${done}/${total}` : null,
    complete ? "Terminé" : null,
  ].filter(Boolean);

  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      className={`plan-card${current ? " is-on" : ""}${active ? " is-active" : ""}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onPick}
    >
      <span className="plan-card-swatch" style={planCoverStyle(plan.id)} aria-hidden="true">
        <span className="plan-card-mark">{title.charAt(0)}</span>
      </span>
      <span className="plan-card-body">
        <span className="plan-card-title">{title}</span>
        {metaParts.length ? (
          <span className="plan-card-meta">{metaParts.join(" · ")}</span>
        ) : (
          <span className="plan-card-meta plan-card-meta--placeholder" aria-hidden>
            &nbsp;
          </span>
        )}
        {total && started ? (
          <span className="plan-card-progress" aria-hidden="true">
            <span className="plan-card-progress-track">
              <span className="plan-card-progress-fill" style={{ width: `${pct}%` }} />
            </span>
          </span>
        ) : (
          <span className="plan-card-progress plan-card-progress--placeholder" aria-hidden>
            <span className="plan-card-progress-track" />
          </span>
        )}
      </span>
      <span className="plan-card-cta">
        {action}
        <YvIcon name="chevron_right" opsz={20} className="plan-card-cta-icon" />
      </span>
    </button>
  );
}
