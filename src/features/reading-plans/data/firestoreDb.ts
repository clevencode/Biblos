/**
 * Data — Firestore offline-first (persistentLocalCache).
 */

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseWebOptionsForInit, isReadingPlansFirebaseConfigured } from "./firebaseConfig";

let db: Firestore | null = null;
let initPromise: Promise<Firestore | null> | null = null;

export function getReadingPlansFirestore(): Firestore | null {
  return db;
}

/**
 * Inicializa App + Firestore com cache persistente (IndexedDB).
 * Leituras subsequentes são servidas do cache local imediatamente.
 */
export async function ensureReadingPlansFirestore(): Promise<Firestore | null> {
  if (db) return db;
  if (!isReadingPlansFirebaseConfigured()) return null;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const options = getFirebaseWebOptionsForInit();
    if (!options) return null;

    const app = getApps().length ? getApp() : initializeApp(options);

    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already been called")) {
        db = getFirestore(app);
      } else {
        throw err;
      }
    }

    return db;
  })();

  try {
    return await initPromise;
  } catch (error) {
    console.error("[reading-plans] Firestore init", error);
    initPromise = null;
    return null;
  }
}
