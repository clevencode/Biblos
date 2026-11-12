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
  clearFirebaseFromProfile,
  applyFirebaseAuthUser,
  loadOrCreateProfile,
  type UserProfile,
} from "../../../../userProfile";
import {
  isConsumerAuthConfigured,
  registerWithEmailPassword,
  resetPasswordForEmail,
  signInWithEmailPassword,
  signInWithGoogle as firebaseSignInGoogle,
  signOutConsumer,
  subscribeConsumerAuth,
  type ConsumerAuthUser,
} from "../../data/consumerFirebaseAuth";

type ConsumerAuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: ConsumerAuthUser | null;
  profile: UserProfile;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => void;
};

const ConsumerAuthContext = createContext<ConsumerAuthContextValue | null>(null);

export function ConsumerAuthProvider({ children }: { children: ReactNode }) {
  const configured = isConsumerAuthConfigured();
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<ConsumerAuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile>(() => loadOrCreateProfile());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const stop = subscribeConsumerAuth((next) => {
      setUser(next);
      if (next) {
        setProfile(applyFirebaseAuthUser(next));
      }
      setLoading(false);
    });
    return stop;
  }, [configured]);

  const refreshProfile = useCallback(() => {
    setProfile(loadOrCreateProfile());
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignInGoogle();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Connexion Google impossible";
      setError(message);
      throw err;
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailPassword(email, password);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Connexion e-mail impossible";
      setError(message);
      throw err;
    }
  }, []);

  const registerWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await registerWithEmailPassword(email, password);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Création de compte impossible";
        setError(message);
        throw err;
      }
    },
    [],
  );

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await resetPasswordForEmail(email);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Réinitialisation impossible";
      setError(message);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await signOutConsumer();
    setUser(null);
    setProfile(clearFirebaseFromProfile());
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<ConsumerAuthContextValue>(
    () => ({
      configured,
      loading,
      user,
      profile,
      error,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      resetPassword,
      signOut,
      clearError,
      refreshProfile,
    }),
    [
      configured,
      loading,
      user,
      profile,
      error,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      resetPassword,
      signOut,
      clearError,
      refreshProfile,
    ],
  );

  return (
    <ConsumerAuthContext.Provider value={value}>
      {children}
    </ConsumerAuthContext.Provider>
  );
}

export function useConsumerAuth(): ConsumerAuthContextValue {
  const ctx = useContext(ConsumerAuthContext);
  if (!ctx) {
    throw new Error("useConsumerAuth doit être utilisé sous ConsumerAuthProvider");
  }
  return ctx;
}
