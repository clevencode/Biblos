/**
 * Data — Firebase Auth consumer (Google + e-mail/senha).
 * Mesmo app Firebase que reading-plans / editorial (ensureReadingPlansFirestore).
 */

import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { getApps } from "firebase/app";
import {
  ensureReadingPlansFirestore,
} from "../../reading-plans/data/firestoreDb";
import { isReadingPlansFirebaseConfigured } from "../../reading-plans/data/firebaseConfig";

export type ConsumerAuthUser = Pick<
  User,
  "uid" | "email" | "displayName" | "photoURL"
>;

let auth: Auth | null = null;

export class ConsumerAuthUnavailableError extends Error {
  constructor(message = "Firebase Auth indisponible") {
    super(message);
    this.name = "ConsumerAuthUnavailableError";
  }
}

export function isConsumerAuthConfigured(): boolean {
  return isReadingPlansFirebaseConfigured();
}

async function ensureAuthReady(): Promise<Auth | null> {
  if (!isReadingPlansFirebaseConfigured()) return null;
  const dbOk = await ensureReadingPlansFirestore();
  if (!dbOk || !getApps().length) return null;
  auth = getAuth();
  return auth;
}

export function getConsumerAuth(): Auth | null {
  return auth;
}

function mapUser(user: User | null): ConsumerAuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function subscribeConsumerAuth(
  onChange: (user: ConsumerAuthUser | null) => void,
): Unsubscribe {
  let inner: Unsubscribe | null = null;
  let cancelled = false;

  void ensureAuthReady().then((instance) => {
    if (cancelled || !instance) {
      onChange(null);
      return;
    }
    inner = onAuthStateChanged(instance, (user) => {
      onChange(mapUser(user));
    });
  });

  return () => {
    cancelled = true;
    inner?.();
  };
}

async function signInWithGoogleNative(): Promise<void> {
  const instance = await ensureAuthReady();
  if (!instance) throw new ConsumerAuthUnavailableError();

  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) {
    throw new Error("Connexion Google incomplète (jeton manquant)");
  }
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(instance, credential);
}

async function signInWithGoogleWeb(): Promise<void> {
  const instance = await ensureAuthReady();
  if (!instance) throw new ConsumerAuthUnavailableError();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(instance, provider);
}

export async function signInWithGoogle(): Promise<void> {
  if (!isConsumerAuthConfigured()) {
    throw new ConsumerAuthUnavailableError(
      "Ajoute VITE_FIREBASE_* dans .env (voir .env.example).",
    );
  }
  if (Capacitor.isNativePlatform()) {
    await signInWithGoogleNative();
    return;
  }
  await signInWithGoogleWeb();
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<ConsumerAuthUser> {
  const instance = await ensureAuthReady();
  if (!instance) throw new ConsumerAuthUnavailableError();
  const cred = await signInWithEmailAndPassword(
    instance,
    email.trim(),
    password,
  );
  return mapUser(cred.user)!;
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
): Promise<ConsumerAuthUser> {
  const instance = await ensureAuthReady();
  if (!instance) throw new ConsumerAuthUnavailableError();
  const cred = await createUserWithEmailAndPassword(
    instance,
    email.trim(),
    password,
  );
  return mapUser(cred.user)!;
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const instance = await ensureAuthReady();
  if (!instance) throw new ConsumerAuthUnavailableError();
  await sendPasswordResetEmail(instance, email.trim());
}

export async function signOutConsumer(): Promise<void> {
  const instance = auth ?? (await ensureAuthReady());
  if (!instance) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAuthentication.signOut();
    }
  } catch {
    /* plugin optionnel */
  }
  await signOut(instance);
}

export async function getConsumerIdToken(
  forceRefresh = false,
): Promise<string | null> {
  const instance = auth ?? (await ensureAuthReady());
  if (!instance?.currentUser) return null;
  try {
    return await instance.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}
