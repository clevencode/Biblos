import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  signInWithGoogle as firebaseSignIn,
  signOutFirebase,
  subscribeFirebaseAuth,
  type FirebaseAuthUser,
} from "../firebase/auth";
import { isFirebaseConfigured } from "../firebase/config";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: FirebaseAuthUser | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const stop = subscribeFirebaseAuth((next) => {
      setUser(next);
      setLoading(false);
    });
    return stop;
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignIn();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Connexion Google impossible";
      setError(message);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await signOutFirebase();
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      user,
      error,
      signInWithGoogle,
      signOut,
      clearError,
    }),
    [configured, loading, user, error, signInWithGoogle, signOut, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé sous AuthProvider");
  }
  return ctx;
}
