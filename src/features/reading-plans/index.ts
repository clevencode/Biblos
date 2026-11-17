import { isReadingPlansFirebaseConfigured } from "./data/firebaseConfig";

export type { ReadingPlan, ReadingPlanEtape, ReadingPlanJour } from "./domain/types";
export {
  loadPlanProgress,
  progressCounts,
  isPlanComplete,
  resumeStepIndex,
  resetPlanProgress,
  type PlanProgress,
} from "./domain/planProgress";
export { flattenPlanSteps } from "./domain/planSteps";
export { PlanDiscoverPanel } from "./presentation/PlanDiscoverPanel";
export { useReadingPlansCatalog } from "./presentation/hooks/useReadingPlansCatalog";
export { isReadingPlansFirebaseConfigured };

/** Boot — Firestore + pull opcional para aquecer mirror local offline. */
export async function bootReadingPlansFirestore(): Promise<void> {
  if (!isReadingPlansFirebaseConfigured()) return;
  const { warmupReadingPlansRepository, pullPublishedReadingPlans } = await import(
    "./data/readingPlansRepository"
  );
  const ok = await warmupReadingPlansRepository();
  if (!ok) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  await pullPublishedReadingPlans();
}
