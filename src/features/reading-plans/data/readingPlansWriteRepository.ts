/**
 * Data — gravações Firestore (somente após Auth editorial).
 */

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  type FieldValue,
} from "firebase/firestore";
import { requireEditorialUser } from "../../editorial-auth/data/editorialFirebaseAuth";
import { canPersistReadingPlan } from "../domain/planSaveRules";
import { slugifyPlanId } from "../domain/planSlug";
import type { ReadingPlanEtape } from "../domain/types";
import { ensureReadingPlansFirestore, getReadingPlansFirestore } from "./firestoreDb";
import { READING_PLANS_COLLECTION } from "./readingPlansRepository";

export type ReadingPlanWritePayload = {
  title: string;
  description: string;
  isPublished: boolean;
  totalDays: number;
  etapes: ReadingPlanEtape[];
};

export async function upsertReadingPlan(
  planId: string,
  payload: ReadingPlanWritePayload,
): Promise<{ id: string }> {
  await requireEditorialUser();
  await ensureReadingPlansFirestore();
  const db = getReadingPlansFirestore();
  if (!db) throw new Error("Firestore indisponible");

  const id = slugifyPlanId(planId || payload.title);
  if (!id) throw new Error("Identifiant de plan invalide");
  if (!canPersistReadingPlan(payload.title, payload.etapes)) {
    throw new Error("Titre et au moins un jour valide obligatoires");
  }

  const editor = await requireEditorialUser();
  const ref = doc(db, READING_PLANS_COLLECTION, id);
  const data: ReadingPlanWritePayload & {
    updatedAt: FieldValue;
    updatedBy: string;
  } = {
    ...payload,
    title: payload.title.trim(),
    description: payload.description.trim(),
    totalDays: payload.totalDays,
    updatedAt: serverTimestamp(),
    updatedBy: editor.uid,
  };

  await setDoc(ref, data, { merge: true });
  return { id };
}

export async function deleteReadingPlan(planId: string): Promise<void> {
  const user = await requireEditorialUser();
  void user;
  await ensureReadingPlansFirestore();
  const db = getReadingPlansFirestore();
  if (!db) throw new Error("Firestore indisponible");
  const id = slugifyPlanId(planId);
  if (!id) throw new Error("Identifiant invalide");
  await deleteDoc(doc(db, READING_PLANS_COLLECTION, id));
}
