/**
 * Data — repositório Firestore `reading_plans` (sem UI).
 */

import {
  collection,
  getDocs,
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
import { savePublishedPlansCache } from "./readingPlansLocalCache";

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

function publishedPlansQuery(db: NonNullable<ReturnType<typeof getReadingPlansFirestore>>) {
  return query(
    collection(db, READING_PLANS_COLLECTION),
    where("isPublished", "==", true),
  );
}

/**
 * Subscrição em tempo real — emite primeiro o cache Firestore, depois rede.
 * Cada snapshot publicado actualiza o mirror local (offline APK).
 */
export function subscribePublishedReadingPlans(
  options: SubscribePublishedPlansOptions,
): Unsubscribe | null {
  const db = getReadingPlansFirestore();
  if (!db) return null;

  return onSnapshot(
    publishedPlansQuery(db),
    (snap) => {
      const mapped = mapSnapshot(snap);
      if (mapped.plans.length > 0) {
        savePublishedPlansCache(mapped.plans);
      }
      options.onData(mapped);
    },
    (error) => options.onError?.(error),
  );
}

/** Garante DB pronto antes da primeira subscrição. */
export async function warmupReadingPlansRepository(): Promise<boolean> {
  const db = await ensureReadingPlansFirestore();
  return db != null;
}

/**
 * Pull one-shot para aquecer mirror local (boot / primeira rede).
 * Falha silenciosa se offline — o hook usa o cache em disco.
 */
export async function pullPublishedReadingPlans(): Promise<ReadingPlansSnapshot | null> {
  const db = await ensureReadingPlansFirestore();
  if (!db) return null;
  try {
    const snap = await getDocs(publishedPlansQuery(db));
    const mapped = mapSnapshot(snap);
    if (mapped.plans.length > 0) {
      savePublishedPlansCache(mapped.plans);
    }
    return mapped;
  } catch (err) {
    console.warn("[reading-plans] pullPublished", err);
    return null;
  }
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
