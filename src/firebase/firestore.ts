import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "./app";
import { isFirebaseConfigured } from "./config";

let db: Firestore | null = null;

export function getFirestoreDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  if (db) return db;
  const app = getFirebaseApp();
  if (!app) return null;
  db = getFirestore(app);
  return db;
}

export function firestoreUserRoot(uid: string): string {
  return `users/${uid}`;
}
