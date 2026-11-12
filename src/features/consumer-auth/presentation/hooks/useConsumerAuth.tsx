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
  applyFirebaseAuthUser,
  clearFirebaseFromProfile,
  loadOrCreateProfile,
  type UserProfile,
} from "../../../../userProfile";
import {
  deleteFirebaseUser,
  ensureAnonymousSession,
  isConsumerAuthConfigured,
  isNetworkAuthError,
  resetPasswordForEmail,
  signOutConsumer,
  subscribeConsumerAuth,
  upgradeOrSignInWithEmail,
  upgradeOrSignInWithGoogle,
  type ConsumerAuthUser,
} from "../../data/consumerFirebaseAuth";
import {
  clearPersonalLocalData,
  deleteUserCloudData,
  mergeLocalSnapshotIntoStores,
  snapshotLocalUserData,
  startUserDataSync,
  stopUserDataSync,
  type LocalUserDataSnapshot,
} from "../../../user-sync";

export type AuthSessionState =
  | { status: "initializing" }
  | { status: "offline_guest"; localId: string }
  | { status: "anonymous"; uid: string }
  | {
      status: "authenticated";
      uid: string;
      email: string | null;
      displayName: string | null;
      photoURL: string | null;
    };

type ConsumerAuthContextValue = {
  configured: boolean;
  session: AuthSessionState;
  loading: boolean;
  /** Utilisateur Firebase (anonymous ou authenticated). null si offline_guest. */
  user: ConsumerAuthUser | null;
  profile: UserProfile;
  error: string | null;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccountAndData: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => void;
};

const ConsumerAuthContext = createContext<ConsumerAuthContextValue | null>(null);

function sessionFromUser(
  user: ConsumerAuthUser | null,
  offlineLocalId: string,
): AuthSessionState {
  if (!user) {
    return { status: "offline_guest", localId: offlineLocalId };
  }
  if (user.isAnonymous) {
    return { status: "anonymous", uid: user.uid };
  }
  return {
    status: "authenticated",
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function ConsumerAuthProvider({ children }: { children: ReactNode }) {
  const configured = isConsumerAuthConfigured();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<ConsumerAuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile>(() => loadOrCreateProfile());
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSessionState>({
    status: "initializing",
  });

  const refreshProfile = useCallback(() => {
    setProfile(loadOrCreateProfile());
  }, []);

  useEffect(() => {
    if (!configured) {
      const local = loadOrCreateProfile();
      setProfile(local);
      setSession({ status: "offline_guest", localId: local.id });
      setLoading(false);
      return;
    }

    let cancelled = false;
    let booted = false;

    const stop = subscribeConsumerAuth((next) => {
      if (cancelled) return;
      setUser(next);
      if (next) {
        const p = applyFirebaseAuthUser(next);
        setProfile(p);
        setSession(sessionFromUser(next, p.id));
        void startUserDataSync(next.uid);
      } else if (booted) {
        stopUserDataSync();
        const local = loadOrCreateProfile();
        setProfile(local);
        setSession({ status: "offline_guest", localId: local.id });
      }
      setLoading(false);
    });

    void (async () => {
      try {
        const anon = await ensureAnonymousSession();
        if (cancelled) return;
        booted = true;
        if (anon) {
          setUser(anon);
          const p = applyFirebaseAuthUser(anon);
          setProfile(p);
          setSession(sessionFromUser(anon, p.id));
          void startUserDataSync(anon.uid);
        } else {
          const local = loadOrCreateProfile();
          setProfile(local);
          setSession({ status: "offline_guest", localId: local.id });
        }
      } catch (err) {
        if (cancelled) return;
        booted = true;
        if (isNetworkAuthError(err)) {
          const local = loadOrCreateProfile();
          setProfile(local);
          setSession({ status: "offline_guest", localId: local.id });
        } else {
          console.warn("[auth] anonymous boot", err);
          const local = loadOrCreateProfile();
          setProfile(local);
          setSession({ status: "offline_guest", localId: local.id });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
      stopUserDataSync();
    };
  }, [configured]);

  const runUpgrade = useCallback(
    async (action: () => Promise<{ user: ConsumerAuthUser; linked: boolean }>) => {
      setError(null);
      const snapshot: LocalUserDataSnapshot = snapshotLocalUserData();
      try {
        const result = await action();
        if (!result.linked) {
          // Compte existant : merger le snapshot local dans les stores puis push
          mergeLocalSnapshotIntoStores(snapshot);
        }
        setUser(result.user);
        setProfile(applyFirebaseAuthUser(result.user));
        setSession(sessionFromUser(result.user, result.user.uid));
        await startUserDataSync(result.user.uid);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Connexion impossible";
        setError(message);
        throw err;
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    await runUpgrade(() => upgradeOrSignInWithGoogle());
  }, [runUpgrade]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      await runUpgrade(() =>
        upgradeOrSignInWithEmail(email, password, "signin"),
      );
    },
    [runUpgrade],
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string) => {
      await runUpgrade(() =>
        upgradeOrSignInWithEmail(email, password, "register"),
      );
    },
    [runUpgrade],
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
    stopUserDataSync();
    clearPersonalLocalData();
    await signOutConsumer();
    setUser(null);
    const local = clearFirebaseFromProfile();
    setProfile(local);
    setSession({ status: "offline_guest", localId: local.id });
    // Re-créer session anonyme si possible (sans bloquer)
    try {
      const anon = await ensureAnonymousSession();
      if (anon) {
        setUser(anon);
        const p = applyFirebaseAuthUser(anon);
        setProfile(p);
        setSession(sessionFromUser(anon, p.id));
        void startUserDataSync(anon.uid);
      }
    } catch {
      /* offline_guest ok */
    }
  }, []);

  const deleteAccountAndData = useCallback(async () => {
    setError(null);
    const uid = user?.uid;
    stopUserDataSync();
    if (uid) {
      await deleteUserCloudData(uid);
    }
    try {
      await deleteFirebaseUser();
    } catch (err) {
      // Peut échouer si recent login requis — on nettoie quand même le local
      console.warn("[auth] deleteUser", err);
    }
    clearPersonalLocalData();
    setUser(null);
    const local = clearFirebaseFromProfile();
    setProfile(local);
    setSession({ status: "offline_guest", localId: local.id });
  }, [user?.uid]);

  const clearError = useCallback(() => setError(null), []);

  const isAuthenticated = session.status === "authenticated";
  const isAnonymous =
    session.status === "anonymous" || session.status === "offline_guest";

  const value = useMemo<ConsumerAuthContextValue>(
    () => ({
      configured,
      session,
      loading,
      user,
      profile,
      error,
      isAuthenticated,
      isAnonymous,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      resetPassword,
      signOut,
      deleteAccountAndData,
      clearError,
      refreshProfile,
    }),
    [
      configured,
      session,
      loading,
      user,
      profile,
      error,
      isAuthenticated,
      isAnonymous,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      resetPassword,
      signOut,
      deleteAccountAndData,
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
