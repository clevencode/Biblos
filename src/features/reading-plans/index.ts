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

/** Boot — pré-initialise Firestore + cache (appel depuis main.tsx). */
export async function bootReadingPlansFirestore(): Promise<void> {
  if (!isReadingPlansFirebaseConfigured()) return;
  const { warmupReadingPlansRepository } = await import("./data/readingPlansRepository");
  await warmupReadingPlansRepository();
}
