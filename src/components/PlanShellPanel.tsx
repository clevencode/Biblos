import { YvIcon } from "./YvIcon";

type PlanShellPanelProps = {
  active: boolean;
  onOpenBible: () => void;
};

export function PlanShellPanel({ active, onOpenBible }: PlanShellPanelProps) {
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
      <div className="plan-discover-surface">
        <div className="plan-discover-empty" role="status">
          <p className="plan-discover-empty-title">Aucun plan pour l’instant</p>
          <p className="muted">
            Les plans dynamiques reviendront avec le catalogue éditorial. En attendant, lisez
            librement dans la Bible (Segond 21 ou Haïtienne 1998).
          </p>
          <button type="button" className="home-empty-cta type-label" onClick={onOpenBible}>
            <YvIcon name="menu_book" opsz={20} className="yv-icon" aria-hidden />
            Ouvrir la Bible
          </button>
        </div>
      </div>
    </div>
  );
}
