import { useState, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

type AuthGateProps = {
  children?: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const { configured, loading, user, error, signInWithGoogle, clearError } =
    useAuth();
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <div className="profile-onboarding" role="alert">
        <div className="profile-onboarding-card">
          <p className="profile-onboarding-brand">Biblos</p>
          <h1 className="profile-onboarding-title type-title">Configuration</h1>
          <p className="profile-onboarding-lead muted">
            Variables Firebase manquantes. Ajoute les clés{" "}
            <code>VITE_FIREBASE_*</code> dans ton fichier <code>.env</code> (voir{" "}
            <code>.env.example</code>).
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="profile-onboarding" aria-busy="true">
        <div className="profile-onboarding-card">
          <p className="profile-onboarding-brand">Biblos</p>
          <p className="profile-onboarding-lead muted">Chargement…</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  async function handleGoogle() {
    if (busy) return;
    clearError();
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      /* erreur affichée via context */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-onboarding" role="dialog" aria-modal="true">
      <div className="profile-onboarding-card">
        <p className="profile-onboarding-brand">Biblos</p>
        <h1 className="profile-onboarding-title type-title">Connexion</h1>
        <p className="profile-onboarding-lead muted">
          Connecte-toi avec Google pour synchroniser ton profil entre appareils.
          L’audio biblique et la lecture restent disponibles après connexion.
        </p>
        {error ? (
          <p className="profile-onboarding-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="auth-google-btn"
          disabled={busy}
          onClick={() => void handleGoogle()}
        >
          <span className="auth-google-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="20" height="20">
              <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-5.514 0-10-4.486-10-10s4.486-10 10-10c2.836 0 5.413 1.172 7.267 3.062l5.657-5.657C33.64 10.894 28.963 8 24 8 14.523 8 6.5 16.523 6.5 26S14.523 44 24 44c9.242 0 17-6.687 17-16 0-1.083-.117-2.134-.328-3.167z"
              />
              <path
                fill="#FF3D00"
                d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.836 0 5.413 1.172 7.267 3.062l5.657-5.657C33.64 10.894 28.963 8 24 8 16.318 8 9.656 13.337 6.306 20.691z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c4.963 0 9.204-1.637 12.28-4.453l-5.688-4.805C29.083 36 24.514 32 24 32c-5.186 0-9.606-3.328-11.197-7.967l-6.52 5.02C8.5 39.556 15.682 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 5.688 4.805C36.504 39.203 44 34 44 26c0-1.083-.117-2.134-.328-3.167z"
              />
            </svg>
          </span>
          Continuer avec Google
        </button>
      </div>
    </div>
  );
}
