import { YvIcon } from "../../../components/YvIcon";
import { useReadingPlansCatalog } from "./hooks/useReadingPlansCatalog";
import { PlanCardRow } from "./PlanCardRow";
import { PlanDiscoverSkeleton } from "./PlanDiscoverSkeleton";
import type { ReadingPlan } from "../domain/types";

type PlanDiscoverPanelProps = {
  active: boolean;
  onOpenBible: () => void;
  onSelectPlan?: (plan: ReadingPlan) => void;
};

/**
 * Presentation — postura fixa (`plan-discover-surface`), skeleton antes do 1.º snapshot.
 */
export function PlanDiscoverPanel({
  active,
  onOpenBible,
  onSelectPlan,
}: PlanDiscoverPanelProps) {
  const { status, plans, error, showSkeleton } = useReadingPlansCatalog(active);

  const showList = !showSkeleton && plans.length > 0;
  const showEmpty = !showSkeleton && status === "ready" && plans.length === 0;
  const showError = status === "error" && plans.length === 0;
  const showUnconfigured = status === "unconfigured";

  return (
    <div
      id="panel-today"
      role="tabpanel"
      aria-labelledby="tab-today"
      hidden={!active}
      className="pane-body today-view plan-discover"
    >
      <header className="plan-discover-head">
        <h1 className="plan-discover-title type-headline">Plans de lecture</h1>
      </header>

      <div
        className="plan-discover-surface"
        aria-busy={showSkeleton || undefined}
        aria-live="polite"
      >
        {showSkeleton ? <PlanDiscoverSkeleton /> : null}

        {showList ? (
          <ul className="plan-discover-grid is-stack" role="list">
            {plans.map((plan) => (
              <li key={plan.id}>
                <PlanCardRow
                  plan={plan}
                  onSelect={(p) => {
                    onSelectPlan?.(p);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {showEmpty ? (
          <div className="plan-discover-empty" role="status">
            <p className="plan-discover-empty-title">Aucun plan publié</p>
            <p className="muted">
              Les plans apparaissent ici lorsque <code>isPublished</code> est vrai dans
              Firestore.
            </p>
            <button type="button" className="home-empty-cta type-label" onClick={onOpenBible}>
              <YvIcon name="menu_book" opsz={20} className="yv-icon" aria-hidden />
              Ouvrir la Bible
            </button>
          </div>
        ) : null}

        {showError ? (
          <div className="plan-discover-empty" role="alert">
            <p className="plan-discover-empty-title">Catalogue indisponible</p>
            <p className="muted">{error ?? "Erreur inconnue"}</p>
            <button type="button" className="home-empty-cta type-label" onClick={onOpenBible}>
              Ouvrir la Bible
            </button>
          </div>
        ) : null}

        {showUnconfigured ? (
          <div className="plan-discover-empty" role="status">
            <p className="plan-discover-empty-title">Firebase non configuré</p>
            <p className="muted">
              Définissez les variables <code>VITE_FIREBASE_*</code> pour charger les plans depuis
              Firestore.
            </p>
            <button type="button" className="home-empty-cta type-label" onClick={onOpenBible}>
              Ouvrir la Bible
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
