/**
 * Init Firebase único (Auth + Firestore offline persistent cache).
 * Textos bíblicos / índices de busca NÃO passam por aqui.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

type FirebaseWebOptions = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

function cleanEnv(value: string | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function readOptions(): FirebaseWebOptions | null {
  const apiKey = cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY);
  const authDomain = cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  const projectId = cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID);
  const appId = cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID);
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

export function isFirebaseConfigured(): boolean {
  return readOptions() != null;
}

/** Alias — reading-plans / legado. */
export function isReadingPlansFirebaseConfigured(): boolean {
  return isFirebaseConfigured();
}

export function getFirebaseWebOptionsForInit(): FirebaseWebOptions | null {
  return readOptions();
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let initPromise: Promise<{ app: FirebaseApp; auth: Auth; db: Firestore } | null> | null =
  null;

function getOrInitApp(): FirebaseApp | null {
  if (app) return app;
  const options = readOptions();
  if (!options) return null;
  app = getApps().length ? getApp() : initializeApp(options);
  return app;
}

function getOrInitAuth(firebaseApp: FirebaseApp): Auth {
  if (auth) return auth;
  auth = getAuth(firebaseApp);
  return auth;
}

function getOrInitDb(firebaseApp: FirebaseApp): Firestore {
  if (db) return db;
  try {
    db = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already been called")) {
      db = getFirestore(firebaseApp);
    } else {
      throw err;
    }
  }
  return db;
}

/**
 * Inicializa App + Auth + Firestore (cache persistente multi-aba).
 * Seguro chamar várias vezes.
 */
export async function ensureFirebase(): Promise<{
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
} | null> {
  if (app && auth && db) return { app, auth, db };
  if (!isFirebaseConfigured()) return null;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const firebaseApp = getOrInitApp();
    if (!firebaseApp) return null;
    const firebaseAuth = getOrInitAuth(firebaseApp);
    const firestore = getOrInitDb(firebaseApp);
    return { app: firebaseApp, auth: firebaseAuth, db: firestore };
  })();

  try {
    return await initPromise;
  } catch (error) {
    console.error("[firebase] init", error);
    initPromise = null;
    return null;
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  return app ?? getOrInitApp();
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getOrInitApp();
  if (!firebaseApp) return null;
  return getOrInitAuth(firebaseApp);
}

export function getFirebaseDb(): Firestore | null {
  return db;
}

/** Compat reading-plans. */
export async function ensureReadingPlansFirestore(): Promise<Firestore | null> {
  const ready = await ensureFirebase();
  return ready?.db ?? null;
}

export function getReadingPlansFirestore(): Firestore | null {
  return db;
}
