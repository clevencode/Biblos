import {
  enableIndexedDbPersistence,
  type Firestore,
} from "firebase/firestore";

let persistenceAttempted = false;

/** Cache Firestore offline (mobile-first). Ignore erreur multi-onglet. */
export async function ensureFirestoreOffline(db: Firestore): Promise<void> {
  if (persistenceAttempted) return;
  persistenceAttempted = true;
  try {
    await enableIndexedDbPersistence(db);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "failed-precondition") {
      console.warn("[biblos] Persistance Firestore : un seul onglet actif.");
      return;
    }
    if (code === "unimplemented") {
      return;
    }
    console.warn("[biblos] Persistance Firestore indisponible.", error);
  }
}
