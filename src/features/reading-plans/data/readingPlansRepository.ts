/**
 * Data — repositório Firestore `reading_plans` (sem UI).
 */

import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type FirestoreError,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import {
  normalizeReadingPlan,
  normalizeReadingPlanDocument,
} from "../domain/normalizeReadingPlan";
import type { ReadingPlan, ReadingPlanFirestoreDoc } from "../domain/types";
import { ensureReadingPlansFirestore, getReadingPlansFirestore } from "./firestoreDb";

export const READING_PLANS_COLLECTION = "reading_plans";

export type ReadingPlansSnapshot = {
  plans: ReadingPlan[];
  fromCache: boolean;
  hasPendingWrites: boolean;
};

export type SubscribePublishedPlansOptions = {
  onData: (snapshot: ReadingPlansSnapshot) => void;
  onError?: (error: FirestoreError) => void;
};

function mapSnapshot(snap: QuerySnapshot<DocumentData>): ReadingPlansSnapshot {
  const plans: ReadingPlan[] = [];
  for (const doc of snap.docs) {
    const parsed = normalizeReadingPlan(
      doc.id,
      doc.data() as ReadingPlanFirestoreDoc,
    );
    if (parsed) plans.push(parsed);
  }
  plans.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  return {
    plans,
    fromCache: snap.metadata.fromCache,
    hasPendingWrites: snap.metadata.hasPendingWrites,
  };
}

/**
 * Subscrição em tempo real — emite primeiro o cache local, depois rede.
 */
export function subscribePublishedReadingPlans(
  options: SubscribePublishedPlansOptions,
): Unsubscribe | null {
  const db = getReadingPlansFirestore();
  if (!db) return null;

  const q = query(
    collection(db, READING_PLANS_COLLECTION),
    where("isPublished", "==", true),
  );

  return onSnapshot(
    q,
    (snap) => options.onData(mapSnapshot(snap)),
    (error) => options.onError?.(error),
  );
}

/** Garante DB pronto antes da primeira subscrição. */
export async function warmupReadingPlansRepository(): Promise<boolean> {
  const db = await ensureReadingPlansFirestore();
  return db != null;
}

export type EditorReadingPlansSnapshot = {
  plans: ReadingPlan[];
  fromCache: boolean;
};

function mapEditorSnapshot(snap: QuerySnapshot<DocumentData>): EditorReadingPlansSnapshot {
  const plans: ReadingPlan[] = [];
  for (const docSnap of snap.docs) {
    const parsed = normalizeReadingPlanDocument(
      docSnap.id,
      docSnap.data() as ReadingPlanFirestoreDoc,
    );
    if (parsed) plans.push(parsed);
  }
  plans.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  return { plans, fromCache: snap.metadata.fromCache };
}

/** Admin — todos os documentos (incl. rascunhos), tempo real. */
export function subscribeEditorReadingPlans(options: {
  onData: (snapshot: EditorReadingPlansSnapshot) => void;
  onError?: (error: FirestoreError) => void;
}): Unsubscribe | null {
  const db = getReadingPlansFirestore();
  if (!db) return null;

  const ref = collection(db, READING_PLANS_COLLECTION);
  return onSnapshot(
    ref,
    (snap) => options.onData(mapEditorSnapshot(snap)),
    (error) => options.onError?.(error),
  );
}
