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

function hasStartedPlan(plan: ReadingPlan): boolean {
  const progress = loadPlanProgress(plan.id);
  if (!progress) return false;
  if (isPlanComplete(plan, progress)) return true;
  const { done } = progressCounts(plan, progress);
  return done > 0 || progress.lastJour != null;
}

/**
 * Hub minimalista — só grelha de planos (sem topbar / tabs).
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

  useEffect(() => subscribePlanProgress(() => setProgressTick((n) => n + 1)), []);

  const orderedPlans = useMemo(() => {
    void progressTick;
    const started: ReadingPlan[] = [];
    const rest: ReadingPlan[] = [];
    for (const plan of plans) {
      if (hasStartedPlan(plan)) started.push(plan);
      else rest.push(plan);
    }
    started.sort((a, b) => {
      const aComplete = isPlanComplete(a, loadPlanProgress(a.id));
      const bComplete = isPlanComplete(b, loadPlanProgress(b.id));
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      const aAt = loadPlanProgress(a.id)?.startedAt || "";
      const bAt = loadPlanProgress(b.id)?.startedAt || "";
      return bAt.localeCompare(aAt);
    });
    return [...started, ...rest];
  }, [plans, progressTick]);

  const showList = !isInitialLoading && orderedPlans.length > 0;
  const showSkeleton = isInitialLoading && plans.length === 0;
  const showEmpty = !isInitialLoading && status === "ready" && plans.length === 0;
  const showError = status === "error" && plans.length === 0;
  const showUnconfigured = status === "unconfigured";

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
      className="pane-body today-view plan-discover is-minimal-hub"
    >
      <h1 id="plan-page-title" className="sr-only">
        {t("shell.plan")}
      </h1>
      <div
        className="plan-discover-scroller"
        aria-busy={isInitialLoading || undefined}
        aria-live="polite"
      >
        <div className="plan-discover-surface">
          {showSkeleton ? (
            <div className="plan-discover-catalog" aria-hidden="true">
              <div className="plan-discover-grid is-stack">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={`plan-skel-${index}`}
                    className="plan-card is-skeleton"
                    aria-hidden="true"
                  >
                    <span className="plan-card-swatch" aria-hidden />
                    <span className="plan-card-body">
                      <span
                        className="plan-card-skel-bar plan-card-skel-bar--title"
                        style={{ width: `${72 - index * 6}%` }}
                      />
                      <span
                        className="plan-card-meta plan-card-meta--placeholder plan-card-skel-bar plan-card-skel-bar--meta"
                        style={{ width: `${42 + index * 4}%` }}
                      />
                    </span>
                    <span className="plan-card-cta type-label" aria-hidden>
                      <span className="plan-card-skel-bar plan-card-skel-bar--cta" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {showList ? (
            <div className="plan-discover-catalog">
              <div className="plan-discover-grid is-stack" role="list">
                {orderedPlans.map((plan) => (
                  <div key={plan.id} role="listitem">
                    <PlanCardRow
                      plan={plan}
                      emphasize={hasStartedPlan(plan)}
                      onSelect={(p) => onSelectPlan?.(p)}
                    />
                  </div>
                ))}
              </div>
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
