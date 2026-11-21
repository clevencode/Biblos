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
  /** Marque le jour lu — sans naviguer (la note s’affiche d’abord). */
  onAdvance: () => void;
  /** Après la note du jour : passe au jour suivant s’il existe. */
  onAdvanceAfterNote: () => void;
};

type UsePlanReadingSessionOptions = {
  onNavigate: (ref: string) => void;
};

export function usePlanReadingSession({ onNavigate }: UsePlanReadingSessionOptions) {
  const [activePlan, setActivePlan] = useState<ReadingPlan | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  /** Ref cliquée no hero (multi-passagem) — limpa ao mudar de dia via chrome. */
  const [focusOverride, setFocusOverride] = useState<string | null>(null);

  const steps = useMemo(
    () => (activePlan ? flattenPlanSteps(activePlan) : []),
    [activePlan],
  );

  const goToStep = useCallback(
    (
      plan: ReadingPlan,
      idx: number,
      stepsList: PlanDayStep[],
      passageOverride?: string | null,
    ) => {
      const clamped = Math.max(0, Math.min(idx, stepsList.length - 1));
      const step = stepsList[clamped];
      if (!step) return;
      setStepIndex(clamped);
      const override = passageOverride?.trim() || null;
      setFocusOverride(override);
      touchPlanJour(plan.id, step.jour);
      onNavigate(passageFocusRef(override ?? step.passage));
    },
    [onNavigate],
  );

  const openPlanAtJour = useCallback(
    (plan: ReadingPlan, jour: number, passage?: string) => {
      const flat = flattenPlanSteps(plan);
      if (!flat.length) return;
      const idx = flat.findIndex((s) => s.jour === jour);
      const target = idx >= 0 ? idx : resumeStepIndex(plan);
      ensurePlanStart(plan.id);
      setActivePlan(plan);
      goToStep(plan, target, flat, passage ?? null);
    },
    [goToStep],
  );

  const clearPlan = useCallback(() => {
    const jour = activePlan ? steps[stepIndex]?.jour : undefined;
    setActivePlan(null);
    setStepIndex(0);
    setFocusOverride(null);
    return jour;
  }, [activePlan, stepIndex, steps]);

  const planReading: PlanReadingChrome | null = useMemo(() => {
    if (!activePlan || !steps.length) return null;
    const step = steps[stepIndex];
    if (!step) return null;
    const focusPassage = focusOverride?.trim() || step.passage;
    const parts = parseUsfmParts(focusPassage);
    const range = parsePassageVerseRange(focusPassage);
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
      label: `Jour ${step.jour} · ${focusPassage}`,
      jour: step.jour,
      focusRef: passageFocusRef(focusPassage),
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
        goToStep(activePlan, stepIndex - 1, steps, null);
      },
      onAdvance: () => {
        markJourComplete(activePlan.id, step.jour);
        // Reste sur le pas — l’UI ouvre « Note du jour ».
      },
      onAdvanceAfterNote: () => {
        if (stepIndex < steps.length - 1) {
          goToStep(activePlan, stepIndex + 1, steps, null);
        }
      },
    };
  }, [activePlan, focusOverride, goToStep, stepIndex, steps]);

  return { openPlanAtJour, planReading, clearPlan, activePlan };
}
