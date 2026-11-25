import { useEffect, useMemo, useState } from "react";
import { YvIcon } from "../../../components/YvIcon";
import {
  isPlanComplete,
  loadPlanProgress,
  progressCounts,
  subscribePlanProgress,
} from "../domain/planProgress";
import type { ReadingPlan } from "../domain/types";
import { useReadingPlansCatalog } from "./hooks/useReadingPlansCatalog";
import { PlanCardRow } from "./PlanCardRow";
import { PlanWorkspacePanel } from "./PlanWorkspacePanel";
import { ShellPageTopbar } from "../../../components/ShellPageTopbar";
import { useUiLocale } from "../../../i18n/UiLocaleContext";

type PlanDiscoverPanelProps = {
  active: boolean;
  workspacePlan?: ReadingPlan | null;
  workspaceJour?: number;
  workspaceResumeSeq?: number;
  onOpenBible: () => void;
  onSelectPlan?: (plan: ReadingPlan) => void;
  onLeaveWorkspace?: () => void;
  onStartPlanReading?: (jour: number, passage?: string) => void;
  onMarkRead?: (jour: number) => void;
  onRestartPlan?: () => void;
};

type CatalogTab = "mine" | "find";

function hasStartedPlan(plan: ReadingPlan): boolean {
  const progress = loadPlanProgress(plan.id);
  if (!progress) return false;
  if (isPlanComplete(plan, progress)) return true;
  const { done } = progressCounts(plan, progress);
  return done > 0 || progress.lastJour != null;
}

/**
 * Presentation — catálogo YouVersion Plans (Mes plans / Découvrir) ou workspace.
 */
export function PlanDiscoverPanel({
  active,
  workspacePlan = null,
  workspaceJour,
  workspaceResumeSeq = 0,
  onOpenBible,
  onSelectPlan,
  onLeaveWorkspace,
  onStartPlanReading,
  onMarkRead,
  onRestartPlan,
}: PlanDiscoverPanelProps) {
  const { t } = useUiLocale();
  const { status, plans, error, isInitialLoading, emptyAfterSync, retry } =
    useReadingPlansCatalog(active && !workspacePlan);
  const [progressTick, setProgressTick] = useState(0);
  const [catalogTab, setCatalogTab] = useState<CatalogTab | null>(null);

  useEffect(() => subscribePlanProgress(() => setProgressTick((n) => n + 1)), []);

  const { mine, discover } = useMemo(() => {
    void progressTick;
    const owned: ReadingPlan[] = [];
    const browse: ReadingPlan[] = [];
    for (const plan of plans) {
      if (hasStartedPlan(plan)) owned.push(plan);
      else browse.push(plan);
    }
    owned.sort((a, b) => {
      const aComplete = isPlanComplete(a, loadPlanProgress(a.id));
      const bComplete = isPlanComplete(b, loadPlanProgress(b.id));
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      const aAt = loadPlanProgress(a.id)?.startedAt || "";
      const bAt = loadPlanProgress(b.id)?.startedAt || "";
      return bAt.localeCompare(aAt);
    });
    return { mine: owned, discover: browse };
  }, [plans, progressTick]);

  const resolvedTab: CatalogTab =
    catalogTab ?? (mine.length > 0 ? "mine" : "find");

  const showList = !isInitialLoading && plans.length > 0;
  const showSkeleton = isInitialLoading && plans.length === 0;
  const showEmpty = !isInitialLoading && status === "ready" && plans.length === 0;
  const showError = status === "error" && plans.length === 0;
  const showUnconfigured = status === "unconfigured";
  const listPlans = resolvedTab === "mine" ? mine : discover;
  const showMineEmpty = showList && resolvedTab === "mine" && mine.length === 0;
  const showFindEmpty = showList && resolvedTab === "find" && discover.length === 0;

  if (workspacePlan) {
    return (
      <div
        id="panel-plan"
        role="region"
        aria-labelledby="shell-label-plan"
        hidden={!active}
        className="pane-body today-view plan-workspace-host"
      >
        <PlanWorkspacePanel
          plan={workspacePlan}
          focusJour={workspaceJour}
          resumeSeq={workspaceResumeSeq}
          onLeave={onLeaveWorkspace}
          onStartPlanReading={onStartPlanReading}
          onMarkRead={onMarkRead}
          onRestartPlan={onRestartPlan}
        />
      </div>
    );
  }

  return (
    <div
      id="panel-plan"
      role="region"
      aria-labelledby="shell-label-plan"
      hidden={!active}
      className="pane-body today-view plan-discover"
    >
      <ShellPageTopbar
        className="plan-discover-topbar"
        titleId="plan-page-title"
        title={t("shell.plan")}
        subtitle={t("home.plans")}
      />
      {showList || showSkeleton ? (
        <div
          className="plan-discover-head"
          role="tablist"
          aria-label={t("home.plans")}
        >
          <div className="flash-deck-tabs plan-discover-tabs">
            <button
              type="button"
              role="tab"
              id="plan-tab-mine"
              aria-selected={resolvedTab === "mine"}
              aria-controls="plan-catalog-panel"
              className={`flash-deck-tab${resolvedTab === "mine" ? " is-on" : ""}${
                mine.length === 0 ? " is-empty" : ""
              }`}
              onClick={() => setCatalogTab("mine")}
            >
              <span className="flash-deck-tab-label">{t("plan.myPlans")}</span>
              {mine.length > 0 ? (
                <span className="flash-deck-tab-count">{mine.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              id="plan-tab-find"
              aria-selected={resolvedTab === "find"}
              aria-controls="plan-catalog-panel"
              className={`flash-deck-tab${resolvedTab === "find" ? " is-on" : ""}`}
              onClick={() => setCatalogTab("find")}
            >
              <span className="flash-deck-tab-label">{t("plan.findPlans")}</span>
              {discover.length > 0 ? (
                <span className="flash-deck-tab-count">{discover.length}</span>
              ) : null}
            </button>
          </div>
        </div>
      ) : null}
      <div
        className="plan-discover-scroller"
        aria-busy={isInitialLoading || undefined}
        aria-live="polite"
      >
        <div
          id="plan-catalog-panel"
          role="tabpanel"
          aria-labelledby={
            resolvedTab === "mine" ? "plan-tab-mine" : "plan-tab-find"
          }
          className="plan-discover-surface"
        >
          {showSkeleton ? (
            <div className="plan-discover-catalog" aria-hidden="true">
              <ul className="plan-discover-grid is-stack" role="presentation">
                {Array.from({ length: 4 }, (_, index) => (
                  <li key={`plan-skel-${index}`}>
                    <div className="plan-card is-skeleton" aria-hidden="true">
                      <span className="plan-card-swatch" aria-hidden />
                      <span className="plan-card-body">
                        <span
                          className="plan-card-skel-bar plan-card-skel-bar--title"
                          style={{ width: `${72 - index * 6}%` }}
                        />
                        <span
                          className={`plan-card-meta plan-card-meta--placeholder plan-card-skel-bar plan-card-skel-bar--meta`}
                          style={{ width: `${42 + index * 4}%` }}
                        />
                      </span>
                      <span className="plan-card-cta type-label" aria-hidden>
                        <span className="plan-card-skel-bar plan-card-skel-bar--cta" />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showList && listPlans.length > 0 ? (
            <div className="plan-discover-catalog">
              <ul className="plan-discover-grid is-stack" role="list">
                {listPlans.map((plan) => (
                  <li key={plan.id}>
                    <PlanCardRow
                      plan={plan}
                      emphasize={resolvedTab === "mine"}
                      onSelect={(p) => onSelectPlan?.(p)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showMineEmpty ? (
            <div className="plan-discover-empty" role="status">
              <p className="plan-discover-empty-title">{t("plan.mineEmpty")}</p>
              <p className="muted">{t("home.browsePlans")}</p>
              <div className="plan-discover-empty-actions">
                <button
                  type="button"
                  className="home-empty-cta type-label"
                  onClick={() => setCatalogTab("find")}
                >
                  {t("plan.findPlans")}
                </button>
              </div>
            </div>
          ) : null}

          {showFindEmpty ? (
            <div className="plan-discover-empty" role="status">
              <p className="plan-discover-empty-title">{t("plan.empty")}</p>
              <p className="muted">{t("plan.emptyHint")}</p>
              {mine.length > 0 ? (
                <div className="plan-discover-empty-actions">
                  <button
                    type="button"
                    className="home-empty-cta type-label"
                    onClick={() => setCatalogTab("mine")}
                  >
                    {t("plan.myPlans")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {showEmpty ? (
            <div className="plan-discover-empty" role="status">
              <p className="plan-discover-empty-title">{t("plan.empty")}</p>
              <p className="muted">
                {emptyAfterSync ? t("plan.emptyPublishedHint") : t("plan.emptyHint")}
              </p>
              <div className="plan-discover-empty-actions">
                <button
                  type="button"
                  className="home-empty-cta type-label"
                  onClick={retry}
                >
                  {t("plan.retry")}
                </button>
                <button
                  type="button"
                  className="home-empty-cta type-label"
                  onClick={onOpenBible}
                >
                  <YvIcon name="menu_book" opsz={20} className="yv-icon" aria-hidden />
                  {t("home.openBible")}
                </button>
              </div>
            </div>
          ) : null}

          {showError ? (
            <div className="plan-discover-empty" role="alert">
              <p className="plan-discover-empty-title">{t("plan.catalogError")}</p>
              <p className="muted">{error ?? t("plan.catalogErrorHint")}</p>
              <div className="plan-discover-empty-actions">
                <button
                  type="button"
                  className="home-empty-cta type-label"
                  onClick={retry}
                >
                  {t("plan.retry")}
                </button>
                <button
                  type="button"
                  className="home-empty-cta type-label"
                  onClick={onOpenBible}
                >
                  {t("home.openBible")}
                </button>
              </div>
            </div>
          ) : null}

          {showUnconfigured ? (
            <div className="plan-discover-empty" role="status">
              <p className="plan-discover-empty-title">{t("plan.offline")}</p>
              <p className="muted">{t("plan.firebaseMissing")}</p>
              <p className="muted">{t("plan.offlineHint")}</p>
              <button
                type="button"
                className="home-empty-cta type-label"
                onClick={onOpenBible}
              >
                {t("home.openBible")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
