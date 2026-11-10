/**
 * Contrato ouro Firestore — coleção `reading_plans`.
 * Camada Domain : tipos puros, sem SDK.
 */

export type ReadingPlanJour = {
  numero: number;
  passage: string;
};

export type ReadingPlanEtape = {
  order: number;
  name: string;
  jours: ReadingPlanJour[];
};

export type ReadingPlan = {
  id: string;
  title: string;
  description: string;
  isPublished: boolean;
  totalDays: number;
  etapes: ReadingPlanEtape[];
};

/** Dados brutos de um documento Firestore (antes da validação). */
export type ReadingPlanFirestoreDoc = {
  title?: unknown;
  description?: unknown;
  isPublished?: unknown;
  totalDays?: unknown;
  etapes?: unknown;
};
