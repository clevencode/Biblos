import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "./app";
import { isFirebaseConfigured } from "./config";
import { ensureFirestoreOffline } from "./offline";

let db: Firestore | null = null;
let dbInit: Promise<Firestore | null> | null = null;

async function initDb(): Promise<Firestore | null> {
  if (!isFirebaseConfigured()) return null;
  const app = getFirebaseApp();
  if (!app) return null;
  const instance = getFirestore(app);
  await ensureFirestoreOffline(instance);
  return instance;
}

export function getFirestoreDb(): Firestore | null {
  if (db) return db;
  if (!isFirebaseConfigured()) return null;
  const app = getFirebaseApp();
  if (!app) return null;
  db = getFirestore(app);
  if (!dbInit) {
    dbInit = initDb().then((ready) => {
      if (ready) db = ready;
      return ready;
    });
  }
  return db;
}

/** Attend l’init + persistance avant le premier sync critique. */
export async function getFirestoreDbReady(): Promise<Firestore | null> {
  getFirestoreDb();
  if (dbInit) return dbInit;
  return db;
}

export function firestoreUserRoot(uid: string): string {
  return `users/${uid}`;
}
