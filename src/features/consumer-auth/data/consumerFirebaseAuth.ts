/**
 * Data — Auth local-first: anonymous, offline_guest, link Google/e-mail.
 */

import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type AuthCredential,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { ensureFirebase, getFirebaseAuth, isFirebaseConfigured } from "../../../lib/firebase";

export type ConsumerAuthUser = Pick<
  User,
  "uid" | "email" | "displayName" | "photoURL" | "isAnonymous"
>;

export class ConsumerAuthUnavailableError extends Error {
  constructor(message = "Firebase Auth indisponible") {
    super(message);
    this.name = "ConsumerAuthUnavailableError";
  }
}

export function isConsumerAuthConfigured(): boolean {
  return isFirebaseConfigured();
}

async function ensureAuthReady(): Promise<Auth | null> {
  const ready = await ensureFirebase();
  return ready?.auth ?? null;
}

export function getConsumerAuth(): Auth | null {
  return getFirebaseAuth();
}

function mapUser(user: User | null): ConsumerAuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
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

export function isNetworkAuthError(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    code === "auth/network-request-failed" ||
    /network/i.test(message) ||
    /offline/i.test(message)
  );
}

export function isCredentialInUseError(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return (
    code === "auth/credential-already-in-use" ||
    code === "auth/email-already-in-use"
  );
}

/** Extrai AuthCredential de erros link (credential-already-in-use). */
export function getCredentialFromError(err: unknown): AuthCredential | null {
  if (!err || typeof err !== "object") return null;
  const cred = (err as { credential?: AuthCredential | null }).credential;
  return cred ?? null;
}

export async function ensureAnonymousSession(): Promise<ConsumerAuthUser | null> {
  const instance = await ensureAuthReady();
  if (!instance) return null;
  if (instance.currentUser) return mapUser(instance.currentUser);
  try {
    const cred = await signInAnonymously(instance);
    return mapUser(cred.user);
  } catch (err) {
    if (isNetworkAuthError(err)) return null;
    throw err;
  }
}

async function googleCredentialNative(): Promise<AuthCredential> {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) {
    throw new Error("Connexion Google incomplète (jeton manquant)");
  }
  return GoogleAuthProvider.credential(idToken);
}

/**
 * Upgrade ou login Google.
 * Preferência: link se anónimo; fallback sign-in se credential já existe.
 * Retorna `{ linked, user }` e pode lançar com `.credential` para merge.
 */
export async function upgradeOrSignInWithGoogle(): Promise<{
  user: ConsumerAuthUser;
  linked: boolean;
}> {
  const instance = await ensureAuthReady();
  if (!instance) throw new ConsumerAuthUnavailableError();

  const current = instance.currentUser;

  if (Capacitor.isNativePlatform()) {
    const credential = await googleCredentialNative();
    if (current?.isAnonymous) {
      try {
        const linked = await linkWithCredential(current, credential);
        return { user: mapUser(linked.user)!, linked: true };
      } catch (err) {
        if (isCredentialInUseError(err)) {
          const fallback =
            getCredentialFromError(err) ?? credential;
          const signed = await signInWithCredential(instance, fallback);
          return { user: mapUser(signed.user)!, linked: false };
        }
        throw err;
      }
    }
    const signed = await signInWithCredential(instance, credential);
    return { user: mapUser(signed.user)!, linked: false };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  if (current?.isAnonymous) {
    try {
      const linked = await linkWithPopup(current, provider);
      return { user: mapUser(linked.user)!, linked: true };
    } catch (err) {
      if (isCredentialInUseError(err)) {
        const credential = getCredentialFromError(err);
        if (!credential) throw err;
        const signed = await signInWithCredential(instance, credential);
        return { user: mapUser(signed.user)!, linked: false };
      }
      throw err;
    }
  }

  const signed = await signInWithPopup(instance, provider);
  return { user: mapUser(signed.user)!, linked: false };
}

/** @deprecated Prefer upgradeOrSignInWithGoogle */
export async function signInWithGoogle(): Promise<void> {
  await upgradeOrSignInWithGoogle();
}

export async function upgradeOrSignInWithEmail(
  email: string,
  password: string,
  mode: "signin" | "register",
): Promise<{ user: ConsumerAuthUser; linked: boolean }> {
  const instance = await ensureAuthReady();
  if (!instance) throw new ConsumerAuthUnavailableError();
  const trimmed = email.trim();
  const current = instance.currentUser;

  if (mode === "register" && current?.isAnonymous) {
    const credential = EmailAuthProvider.credential(trimmed, password);
    try {
      const linked = await linkWithCredential(current, credential);
      return { user: mapUser(linked.user)!, linked: true };
    } catch (err) {
      if (isCredentialInUseError(err)) {
        const signed = await signInWithEmailAndPassword(
          instance,
          trimmed,
          password,
        );
        return { user: mapUser(signed.user)!, linked: false };
      }
      throw err;
    }
  }

  if (mode === "register") {
    const cred = await createUserWithEmailAndPassword(
      instance,
      trimmed,
      password,
    );
    return { user: mapUser(cred.user)!, linked: false };
  }

  if (current?.isAnonymous) {
    const credential = EmailAuthProvider.credential(trimmed, password);
    try {
      const linked = await linkWithCredential(current, credential);
      return { user: mapUser(linked.user)!, linked: true };
    } catch (err) {
      if (isCredentialInUseError(err)) {
        const signed = await signInWithEmailAndPassword(
          instance,
          trimmed,
          password,
        );
        return { user: mapUser(signed.user)!, linked: false };
      }
      throw err;
    }
  }

  const cred = await signInWithEmailAndPassword(instance, trimmed, password);
  return { user: mapUser(cred.user)!, linked: false };
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<ConsumerAuthUser> {
  const { user } = await upgradeOrSignInWithEmail(email, password, "signin");
  return user;
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
): Promise<ConsumerAuthUser> {
  const { user } = await upgradeOrSignInWithEmail(email, password, "register");
  return user;
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const instance = await ensureAuthReady();
  if (!instance) throw new ConsumerAuthUnavailableError();
  await sendPasswordResetEmail(instance, email.trim());
}

export async function signOutConsumer(): Promise<void> {
  const instance = (await ensureAuthReady()) ?? getFirebaseAuth();
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

export async function deleteFirebaseUser(): Promise<void> {
  const instance = await ensureAuthReady();
  const user = instance?.currentUser;
  if (!user) throw new ConsumerAuthUnavailableError("Aucun utilisateur");
  await deleteUser(user);
}

export async function getConsumerIdToken(
  forceRefresh = false,
): Promise<string | null> {
  const instance = (await ensureAuthReady()) ?? getFirebaseAuth();
  if (!instance?.currentUser) return null;
  try {
    return await instance.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}
