import { useAuth } from "../hooks/useAuth";
import { listMissingFirebaseEnvKeys } from "../firebase/config";
import type { ReactNode } from "react";

type FirebaseConfigGateProps = {
  children?: ReactNode;
};

/** Bloque uniquement si la config Firebase client est absente — pas de login obligatoire. */
export function FirebaseConfigGate({ children }: FirebaseConfigGateProps) {
  const { configured, loading } = useAuth();

  if (!configured) {
    const missing = listMissingFirebaseEnvKeys();
    return (
      <div className="profile-onboarding" role="alert">
        <div className="profile-onboarding-card">
          <p className="profile-onboarding-brand">Biblos</p>
          <h1 className="profile-onboarding-title type-title">Configuration</h1>
          <p className="profile-onboarding-lead muted">
            Auth + Firestore exigent <code>VITE_FIREBASE_API_KEY</code>,{" "}
            <code>AUTH_DOMAIN</code>, <code>PROJECT_ID</code>,{" "}
            <code>APP_ID</code>. En local : <code>.env</code> puis{" "}
            <code>npm run dev</code>. Sur Vercel : Environment Variables +
            redeploy.
          </p>
          {missing.length ? (
            <p className="profile-onboarding-error" role="status">
              Manquant : {missing.map((k) => k.replace("VITE_", "")).join(", ")}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app biblos-shell" aria-busy="true">
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
