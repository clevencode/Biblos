/**
 * Data — Firebase Auth (e-mail / senha) para CMS editorial.
 * Credenciais Firebase só via reading-plans/data/firebaseConfig (mesmo app).
 */

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { getApps } from "firebase/app";
import { ensureReadingPlansFirestore } from "../../reading-plans/data/firestoreDb";

let auth: Auth | null = null;

export class EditorialAuthRequiredError extends Error {
  constructor(message = "Connexion éditoriale requise") {
    super(message);
    this.name = "EditorialAuthRequiredError";
  }
}

async function ensureAuthReady(): Promise<Auth | null> {
  const dbOk = await ensureReadingPlansFirestore();
  if (!dbOk || !getApps().length) return null;
  auth = getAuth();
  return auth;
}

export function getEditorialAuth(): Auth | null {
  return auth;
}

export function subscribeEditorialAuth(
  onChange: (user: User | null) => void,
): Unsubscribe {
  let inner: Unsubscribe | null = null;
  let cancelled = false;

  void ensureAuthReady().then((instance) => {
    if (cancelled || !instance) {
      onChange(null);
      return;
    }
    inner = onAuthStateChanged(instance, onChange);
  });

  return () => {
    cancelled = true;
    inner?.();
  };
}

export async function signInEditor(email: string, password: string): Promise<User> {
  const instance = await ensureAuthReady();
  if (!instance) throw new EditorialAuthRequiredError("Firebase Auth indisponible");
  const cred = await signInWithEmailAndPassword(
    instance,
    email.trim(),
    password,
  );
  return cred.user;
}

export async function signOutEditor(): Promise<void> {
  const instance = auth ?? (await ensureAuthReady());
  if (!instance) return;
  await signOut(instance);
}

function isEditorialAllowlisted(email: string | null | undefined): boolean {
  const needle = String(import.meta.env.VITE_CLEVENCODE_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  // Sem allowlist configurada: qualquer sessão Firebase (comportamento legado).
  if (!needle) return true;
  return (
    String(email ?? "")
      .trim()
      .toLowerCase() === needle
  );
}

/** Barreira obrigatória antes de qualquer write Firestore. */
export async function requireEditorialUser(): Promise<User> {
  const instance = await ensureAuthReady();
  const user = instance?.currentUser ?? null;
  if (!user) throw new EditorialAuthRequiredError();
  if (!isEditorialAllowlisted(user.email)) {
    throw new EditorialAuthRequiredError(
      "Compte non autorisé pour l’édition CMS",
    );
  }
  return user;
}
