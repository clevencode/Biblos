import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  signInEditor,
  signOutEditor,
  subscribeEditorialAuth,
} from "../../data/editorialFirebaseAuth";
import { isClevencodeAdminEmail } from "../../../../userProfile";

export type EditorialAuthPhase = "checking" | "signed_out" | "signed_in";

export function useEditorialAuth() {
  const [phase, setPhase] = useState<EditorialAuthPhase>("checking");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stop = subscribeEditorialAuth((next) => {
      if (next && !isClevencodeAdminEmail(next.email)) {
        setUser(null);
        setPhase("signed_out");
        return;
      }
      setUser(next);
      setPhase(next ? "signed_in" : "signed_out");
    });
    return stop;
  }, []);

  async function signIn(email: string, password: string) {
    setError(null);
    try {
      const next = await signInEditor(email, password);
      if (!isClevencodeAdminEmail(next.email)) {
        await signOutEditor();
        const message = "Compte non autorisé pour l’édition CMS";
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
