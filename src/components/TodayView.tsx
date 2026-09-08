import type { ReadingPlan } from "../types";
import { PlanDescription } from "./PlanDescription";

type TodayViewProps = {
  plan: ReadingPlan | null;
  /** Comme Caderno → goHome : ouvre la Galerie de Plan. */
  onSelectGalerie?: () => void;
};

export function TodayView({ plan, onSelectGalerie }: TodayViewProps) {
  if (!plan) {
    return (
      <div className="today-view panel-nota-content">
        <header className="page-session-head">
          <p className="session-kicker">Thème</p>
          <nav className="crumb page-crumb" aria-label="Local dans la galerie">
            <button type="button" onClick={() => onSelectGalerie?.()}>
              Galerie
            </button>
          </nav>
          <h2 className="page-title">Aucun plan</h2>
          <p className="page-session-meta muted">
            Seed vide (MVP) — synchronise Notion pour charger un plan.
          </p>
        </header>
      </div>
    );
  }

  const planTitle = plan.theme?.trim() || plan.nome;

  return (
    <div className="today-view panel-nota-content">
      <header className="page-session-head">
        <p className="session-kicker">Thème</p>
        <nav className="crumb page-crumb" aria-label="Local dans la galerie">
          <button type="button" onClick={() => onSelectGalerie?.()}>
            Galerie
          </button>
          <span aria-hidden="true">/</span>
          <span className="page-crumb-current">Plan</span>
        </nav>
        <h2 className="page-title">{planTitle}</h2>
        {plan.url ? (
          <div className="page-session-meta">
            <a className="page-open" href={plan.url} target="_blank" rel="noreferrer">
              Ouvrir dans Notion
            </a>
          </div>
        ) : null}
      </header>

      <PlanDescription description={plan.description} />
    </div>
  );
}
