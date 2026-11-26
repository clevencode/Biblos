import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  isEditorialEditor,
  signInEditor,
  signOutEditor,
  subscribeEditorialAuth,
} from "../../data/editorialFirebaseAuth";

export type EditorialAuthPhase = "checking" | "signed_out" | "signed_in";

export function useEditorialAuth() {
  const [phase, setPhase] = useState<EditorialAuthPhase>("checking");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const stop = subscribeEditorialAuth((next) => {
      void (async () => {
        if (!next) {
          if (!alive) return;
          setUser(null);
          setPhase("signed_out");
          return;
        }
        const ok = await isEditorialEditor(next);
        if (!alive) return;
        if (!ok) {
          setUser(null);
          setPhase("signed_out");
          return;
        }
        setUser(next);
        setPhase("signed_in");
      })();
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  async function signIn(email: string, password: string) {
    setError(null);
    try {
      const next = await signInEditor(email, password);
      if (await isEditorialEditor(next)) return;
      await next.getIdToken(true);
      if (!(await isEditorialEditor(next))) {
        await signOutEditor();
        const message =
          "Compte non autorisé pour l’édition CMS (claim admin requis)";
        setError(message);
        throw new Error(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de connexion";
      setError(message);
      throw err;
    }
  }

  async function signOut() {
    setError(null);
    await signOutEditor();
  }

  return {
    phase,
    user,
    error,
    signIn,
    signOut,
    isLocked: phase !== "signed_in",
  };
}
