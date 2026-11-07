import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { readFirebaseWebConfig } from "./config";

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseApp) return firebaseApp;
  const config = readFirebaseWebConfig();
  if (!config) return null;
  firebaseApp = initializeApp(config);
  return firebaseApp;
}

export function getFirebaseAuth(): Auth | null {
  if (firebaseAuth) return firebaseAuth;
  const app = getFirebaseApp();
  if (!app) return null;
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}
