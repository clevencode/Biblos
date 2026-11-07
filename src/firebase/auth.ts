import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./app";
import { isFirebaseConfigured } from "./config";

export type FirebaseAuthUser = Pick<
  User,
  "uid" | "email" | "displayName" | "photoURL"
>;

export function subscribeFirebaseAuth(
  listener: (user: FirebaseAuthUser | null) => void,
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    listener(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      listener(null);
      return;
    }
    listener({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
  });
}

async function signInWithGoogleNative(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase non configuré");

  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) {
    throw new Error("Connexion Google incomplète (jeton manquant)");
  }
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
}

async function signInWithGoogleWeb(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase non configuré");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}

export async function signInWithGoogle(): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Ajoute VITE_FIREBASE_* dans .env (voir .env.example).",
    );
  }
  if (Capacitor.isNativePlatform()) {
    await signInWithGoogleNative();
    return;
  }
  await signInWithGoogleWeb();
}

export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAuthentication.signOut();
    }
  } catch {
    /* plugin optionnel */
  }
  await signOut(auth);
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export async function authHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const token = await getFirebaseIdToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
