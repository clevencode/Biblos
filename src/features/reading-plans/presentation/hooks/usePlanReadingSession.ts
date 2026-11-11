import { useCallback, useMemo, useState } from "react";
import { parseUsfmParts } from "../../../../youversion/client";
import {
  flattenPlanSteps,
  type PlanDayStep,
} from "../../domain/planSteps";
import {
  markJourComplete,
  resumeStepIndex,
  touchPlanJour,
  ensurePlanStart,
} from "../../domain/planProgress";
import { parsePassageVerseRange, passageFocusRef } from "../../domain/passageFocus";
import type { ReadingPlan } from "../../domain/types";

export type PlanReadingChrome = {
  planId: string;
  planName: string;
  planShareTitle?: string;
  planDescription?: string;
  planShareId?: string | null;
  planMeta?: string;
  label: string;
  jour: number;
  focusRef: string;
  isFirst: boolean;
  isLast: boolean;
  /** Dernier jour de l’étape courante — le skip › devient ✓. */
  isStageLast: boolean;
  stageName?: string;
  /** Index 1-based de l’étape parmi les étapes avec jours. */
  stageIndex: number;
  stageCount: number;
  /** Jour 1-based dans l’étape courante. */
  stageDayIndex: number;
  stageDayCount: number;
  stepIndex: number;
  stepCount: number;
  verseStart?: number | null;
  verseEnd?: number | null;
  onPrev: () => void;
  onAdvance: () => void;
};

type UsePlanReadingSessionOptions = {
  onNavigate: (ref: string) => void;
};

export function usePlanReadingSession({ onNavigate }: UsePlanReadingSessionOptions) {
  const [activePlan, setActivePlan] = useState<ReadingPlan | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => (activePlan ? flattenPlanSteps(activePlan) : []),
    [activePlan],
  );

  const goToStep = useCallback(
    (plan: ReadingPlan, idx: number, stepsList: PlanDayStep[]) => {
      const clamped = Math.max(0, Math.min(idx, stepsList.length - 1));
      const step = stepsList[clamped];
      if (!step) return;
      setStepIndex(clamped);
      touchPlanJour(plan.id, step.jour);
      onNavigate(passageFocusRef(step.passage));
    },
    [onNavigate],
  );

  const openPlanAtJour = useCallback(
    (plan: ReadingPlan, jour: number) => {
      const flat = flattenPlanSteps(plan);
      if (!flat.length) return;
      const idx = flat.findIndex((s) => s.jour === jour);
      const target = idx >= 0 ? idx : resumeStepIndex(plan);
      ensurePlanStart(plan.id);
      setActivePlan(plan);
      goToStep(plan, target, flat);
    },
    [goToStep],
  );

  const openPlan = useCallback(
    (plan: ReadingPlan) => {
      const flat = flattenPlanSteps(plan);
      if (!flat.length) return;
      ensurePlanStart(plan.id);
      const idx = resumeStepIndex(plan);
      setActivePlan(plan);
      goToStep(plan, idx, flat);
    },
    [goToStep],
  );

  const clearPlan = useCallback(() => {
    const jour = activePlan ? steps[stepIndex]?.jour : undefined;
    setActivePlan(null);
    setStepIndex(0);
    return jour;
  }, [activePlan, stepIndex, steps]);

  const planReading: PlanReadingChrome | null = useMemo(() => {
    if (!activePlan || !steps.length) return null;
    const step = steps[stepIndex];
    if (!step) return null;
    const parts = parseUsfmParts(step.passage);
    const range = parsePassageVerseRange(step.passage);
    const stageOrders = [
      ...new Set(steps.map((s) => s.etapeOrder)),
    ].sort((a, b) => a - b);
    const stageCount = stageOrders.length;
    const dayCount = steps.length || activePlan.totalDays;
    const metaParts: string[] = [];
    if (dayCount > 0) {
      metaParts.push(`${dayCount} jour${dayCount > 1 ? "s" : ""}`);
    }
    if (stageCount > 0) {
      metaParts.push(`${stageCount} étape${stageCount > 1 ? "s" : ""}`);
    }
    const meta = metaParts.join(" · ");
    const nextStep = steps[stepIndex + 1];
    const isStageLast =
      !nextStep || nextStep.etapeOrder !== step.etapeOrder;
    const stageIndex = Math.max(1, stageOrders.indexOf(step.etapeOrder) + 1);
    const stageSteps = steps.filter((s) => s.etapeOrder === step.etapeOrder);
    const stageDayIndex = Math.max(
      1,
      stageSteps.findIndex((s) => s.jour === step.jour) + 1,
    );
    const stageDayCount = stageSteps.length;

    return {
      planId: activePlan.id,
      planName: activePlan.title,
      planShareTitle: activePlan.title,
      planDescription: activePlan.description,
      planShareId: activePlan.id,
      planMeta: meta,
      label: `Jour ${step.jour} · ${step.passage}`,
      jour: step.jour,
      focusRef: passageFocusRef(step.passage),
      isFirst: stepIndex <= 0,
      isLast: stepIndex >= steps.length - 1,
      isStageLast,
      stageName: step.etapeName || undefined,
      stageIndex,
      stageCount,
      stageDayIndex,
      stageDayCount,
      stepIndex,
      stepCount: steps.length,
      verseStart: range.verseStart ?? parts.verse ?? null,
      verseEnd: range.verseEnd ?? range.verseStart ?? parts.verse ?? null,
      onPrev: () => {
        if (stepIndex <= 0) return;
        goToStep(activePlan, stepIndex - 1, steps);
      },
      onAdvance: () => {
        markJourComplete(activePlan.id, step.jour);
        // Fin d’étape : rester sur le pas — l’UI ouvre la note puis revient aux plans.
        if (isStageLast) return;
        if (stepIndex < steps.length - 1) {
          goToStep(activePlan, stepIndex + 1, steps);
        }
      },
    };
  }, [activePlan, goToStep, stepIndex, steps]);

  return { openPlan, openPlanAtJour, planReading, clearPlan, activePlan };
}
