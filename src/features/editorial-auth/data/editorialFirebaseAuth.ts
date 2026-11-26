/**
 * Data — Firebase Auth (e-mail / senha) para CMS editorial.
 * Autorização real: custom claim `admin` (espelha firestore.rules).
 * Credenciais Firebase só via reading-plans/data/firebaseConfig (mesmo app).
 */

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { ensureFirebase } from "../../../lib/firebase";
import {
  getClevencodeAdminEmail,
  isClevencodeAdminEmail,
} from "../../../userProfile";

let auth: Auth | null = null;

export class EditorialAuthRequiredError extends Error {
  constructor(message = "Connexion éditoriale requise") {
    super(message);
    this.name = "EditorialAuthRequiredError";
  }
}

async function ensureAuthReady(): Promise<Auth | null> {
  const ready = await ensureFirebase();
  if (!ready) return null;
  auth = ready.auth;
  return auth;
}

export function getEditorialAuth(): Auth | null {
  return auth;
}

/** True se o ID token tem claim `admin` (fonte de verdade alinhada às rules). */
export async function hasEditorialAdminClaim(
  user: User,
  forceRefresh = false,
): Promise<boolean> {
  const token = await user.getIdTokenResult(forceRefresh);
  return token.claims.admin === true;
}

/**
 * Editor autorizado: claim `admin` obrigatório.
 * E-mail allowlist (env) é UX defensiva adicional, não substitui o claim.
 */
export async function isEditorialEditor(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (!(await hasEditorialAdminClaim(user))) return false;
  const emailGate = isClevencodeAdminEmail(user.email);
  // Sem VITE_CLEVENCODE_ADMIN_EMAIL, só o claim conta.
  if (!emailGate && getAdminEmailConfigured()) return false;
  return true;
}

function getAdminEmailConfigured(): boolean {
  return Boolean(getClevencodeAdminEmail());
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

/** Barreira obrigatória antes de qualquer write Firestore. */
export async function requireEditorialUser(): Promise<User> {
  const instance = await ensureAuthReady();
  const user = instance?.currentUser ?? null;
  if (!user) throw new EditorialAuthRequiredError();
  if (await isEditorialEditor(user)) return user;
  // Claim acabado de atribuir via Admin SDK — forçar refresh do ID token
  await user.getIdToken(true);
  if (await isEditorialEditor(user)) return user;
  throw new EditorialAuthRequiredError(
    "Compte non autorisé pour l’édition CMS (claim admin requis)",
  );
}
