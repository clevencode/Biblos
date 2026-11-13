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
import { PlanDiscoverSkeleton } from "./PlanDiscoverSkeleton";
import type { PlanFlowReturn } from "./PlanWorkspacePanel";
import { PlanWorkspacePanel } from "./PlanWorkspacePanel";
import { useUiLocale } from "../../../i18n/UiLocaleContext";

type PlanDiscoverPanelProps = {
  active: boolean;
  workspacePlan?: ReadingPlan | null;
  workspaceJour?: number;
  workspaceResumeSeq?: number;
  onOpenBible: () => void;
  onSelectPlan?: (plan: ReadingPlan) => void;
  onLeaveWorkspace?: () => void;
  onStartPlanReading?: (
    jour: number,
    passage: string,
    opts?: { returnTo?: PlanFlowReturn },
  ) => void;
  onMarkRead?: (jour: number) => void;
  onRestartPlan?: () => void;
};

function isPlanInProgress(plan: ReadingPlan): boolean {
  const progress = loadPlanProgress(plan.id);
  if (!progress) return false;
  if (isPlanComplete(plan, progress)) return false;
  const { done } = progressCounts(plan, progress);
  return done > 0 || progress.lastJour != null;
}

/**
 * Presentation — catálogo ou workspace (timeline / étapes).
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
  const { status, plans, error, showSkeleton } = useReadingPlansCatalog(
    active && !workspacePlan,
  );
  const [progressTick, setProgressTick] = useState(0);

  useEffect(() => subscribePlanProgress(() => setProgressTick((n) => n + 1)), []);

  const { inProgress, rest } = useMemo(() => {
    void progressTick;
    const activePlans: ReadingPlan[] = [];
    const others: ReadingPlan[] = [];
    for (const plan of plans) {
      if (isPlanInProgress(plan)) activePlans.push(plan);
      else others.push(plan);
    }
    activePlans.sort((a, b) => {
      const aAt = loadPlanProgress(a.id)?.startedAt || "";
      const bAt = loadPlanProgress(b.id)?.startedAt || "";
      return bAt.localeCompare(aAt);
    });
    return { inProgress: activePlans, rest: others };
  }, [plans, progressTick]);

  const showList = !showSkeleton && plans.length > 0;
  const showEmpty = !showSkeleton && status === "ready" && plans.length === 0;
  const showError = status === "error" && plans.length === 0;
  const showUnconfigured = status === "unconfigured";
  const splitCatalog = inProgress.length > 0;

  if (workspacePlan) {
    return (
      <div
        id="panel-today"
        role="tabpanel"
        aria-labelledby="tab-today"
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
      id="panel-today"
      role="tabpanel"
      aria-labelledby="tab-today"
      hidden={!active}
      className="pane-body today-view plan-discover"
    >
      <header className="plan-discover-head">
        <h1 className="plan-discover-title type-headline">{t("home.plans")}</h1>
      </header>

      <div
        className="plan-discover-scroller"
        aria-busy={showSkeleton || undefined}
        aria-live="polite"
      >
        <div className="plan-discover-surface">
          {showSkeleton ? <PlanDiscoverSkeleton /> : null}

          {showList ? (
            <div className="plan-discover-catalog">
              {splitCatalog ? (
                <>
                  <section
                    className="plan-discover-section"
                    aria-labelledby="plan-section-active"
                  >
                    <h2
                      id="plan-section-active"
                      className="plan-discover-section-title type-eyebrow"
                    >
                      {t("plan.inProgress")}
                    </h2>
                    <ul className="plan-discover-grid is-stack" role="list">
                      {inProgress.map((plan) => (
                        <li key={plan.id}>
                          <PlanCardRow
                            plan={plan}
                            emphasize
                            onSelect={(p) => onSelectPlan?.(p)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                  {rest.length > 0 ? (
                    <section
                      className="plan-discover-section"
                      aria-labelledby="plan-section-all"
                    >
                      <h2
                        id="plan-section-all"
                        className="plan-discover-section-title type-eyebrow"
                      >
                        {t("plan.all")}
                      </h2>
                      <ul className="plan-discover-grid is-stack" role="list">
                        {rest.map((plan) => (
                          <li key={plan.id}>
                            <PlanCardRow
                              plan={plan}
                              onSelect={(p) => onSelectPlan?.(p)}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              ) : (
                <ul className="plan-discover-grid is-stack" role="list">
                  {plans.map((plan) => (
                    <li key={plan.id}>
                      <PlanCardRow
                        plan={plan}
                        onSelect={(p) => onSelectPlan?.(p)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {showEmpty ? (
            <div className="plan-discover-empty" role="status">
              <p className="plan-discover-empty-title">{t("plan.empty")}</p>
              <p className="muted">{t("plan.emptyHint")}</p>
              <button
                type="button"
                className="home-empty-cta type-label"
                onClick={onOpenBible}
              >
                <YvIcon name="menu_book" opsz={20} className="yv-icon" aria-hidden />
                {t("home.openBible")}
              </button>
            </div>
          ) : null}

          {showError ? (
            <div className="plan-discover-empty" role="alert">
              <p className="plan-discover-empty-title">{t("plan.catalogError")}</p>
              <p className="muted">{error ?? t("plan.catalogErrorHint")}</p>
              <button
                type="button"
                className="home-empty-cta type-label"
                onClick={onOpenBible}
              >
                {t("home.openBible")}
              </button>
            </div>
          ) : null}

          {showUnconfigured ? (
            <div className="plan-discover-empty" role="status">
              <p className="plan-discover-empty-title">{t("plan.offline")}</p>
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
