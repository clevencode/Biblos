import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
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
  const stop = subscribeEditorialAuth((next) => {
      setUser(next);
      setPhase(next ? "signed_in" : "signed_out");
    });
    return stop;
  }, []);

  async function signIn(email: string, password: string) {
    setError(null);
    try {
      await signInEditor(email, password);
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
