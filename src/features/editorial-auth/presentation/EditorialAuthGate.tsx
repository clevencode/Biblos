import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { EditorialAuthPhase } from "./hooks/useEditorialAuth";

type EditorialAuthGateProps = {
  phase: EditorialAuthPhase;
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  children: ReactNode;
};

/**
 * Presentation — painel admin trancado até `signed_in` (reativo ao Auth SDK).
 */
export function EditorialAuthGate({
  phase,
  error,
  onSignIn,
  children,
}: EditorialAuthGateProps) {
  const formId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSignIn(email, password);
    } finally {
      setBusy(false);
    }
  }

  if (phase === "checking") {
    return (
      <div className="editorial-admin-auth editorial-admin-auth--locked" role="status">
        <p className="muted type-caption">Vérification de la session…</p>
      </div>
    );
  }

  if (phase !== "signed_in") {
    return (
      <div className="editorial-admin-auth editorial-admin-auth--locked">
        <header className="profile-head">
          <div className="profile-head-copy">
            <h1 id="editorial-auth-title" className="type-headline">
              Biblos · Édition
            </h1>
            <p className="muted type-caption">Connexion Firebase (e-mail / mot de passe)</p>
          </div>
        </header>
        <form
          id={formId}
          className="profile-admin-form"
          onSubmit={submit}
          aria-labelledby="editorial-auth-title"
        >
          <label className="profile-field">
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="profile-field">
            <span>Mot de passe</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p className="editorial-admin-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="profile-save-btn" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
