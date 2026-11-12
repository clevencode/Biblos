import { useId, useState, type FormEvent } from "react";
import { useConsumerAuth } from "./hooks/useConsumerAuth";

type SignInModalProps = {
  open: boolean;
  title?: string;
  lead?: string;
  /** Soft gate après cote de marques. */
  variant?: "upgrade" | "soft_gate";
  onClose: () => void;
  onSignedIn?: () => void;
};

type EmailMode = "signin" | "register" | "reset";

export function SignInModal({
  open,
  title,
  lead,
  variant = "upgrade",
  onClose,
  onSignedIn,
}: SignInModalProps) {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    error,
    clearError,
  } = useConsumerAuth();
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  const resolvedTitle =
    title ??
    (variant === "soft_gate"
      ? "Garde tes surlignages"
      : "Sauvegarder mes études");
  const resolvedLead =
    lead ??
    (variant === "soft_gate"
      ? "En mode invité, tu peux marquer jusqu’à 10 versets sur cet appareil. Relie un compte pour continuer et retrouver tes surlignages partout."
      : "Connecte un compte Google ou e-mail pour synchroniser marques, notes et plans entre tes appareils.");

  const displayError = localError || error;

  async function finishOk() {
    onSignedIn?.();
    onClose();
  }

  async function handleGoogle() {
    if (busy) return;
    clearError();
    setLocalError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      await finishOk();
    } catch {
      /* context */
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    clearError();
    setLocalError(null);
    setResetSent(false);
    const trimmed = email.trim();
    if (!trimmed) {
      setLocalError("Indique ton e-mail.");
      return;
    }
    if (emailMode !== "reset" && password.length < 6) {
      setLocalError("Mot de passe : au moins 6 caractères.");
      return;
    }
    setBusy(true);
    try {
      if (emailMode === "reset") {
        await resetPassword(trimmed);
        setResetSent(true);
        return;
      }
      if (emailMode === "register") {
        await registerWithEmail(trimmed, password);
      } else {
        await signInWithEmail(trimmed, password);
      }
      await finishOk();
    } catch {
      /* context */
    } finally {
      setBusy(false);
    }
  }

  function switchMode(mode: EmailMode) {
    setEmailMode(mode);
    setLocalError(null);
    setResetSent(false);
    clearError();
  }

  return (
    <div className="sign-in-modal" role="presentation">
      <button
        type="button"
        className="profile-onboarding-backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="profile-onboarding-card sign-in-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-modal-title"
      >
        <p className="profile-onboarding-brand">Biblos</p>
        <h2 id="sign-in-modal-title" className="profile-onboarding-title type-title">
          {resolvedTitle}
        </h2>
        <p className="profile-onboarding-lead muted">{resolvedLead}</p>
        {displayError ? (
          <p className="profile-onboarding-error" role="alert">
            {displayError}
          </p>
        ) : null}
        {resetSent ? (
          <p className="profile-onboarding-lead muted" role="status">
            E-mail de réinitialisation envoyé. Vérifie ta boîte de réception.
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

        <div className="sign-in-divider" role="separator">
          <span>ou</span>
        </div>

        <form
          id={formId}
          className="profile-onboarding-form"
          onSubmit={(e) => void handleEmailSubmit(e)}
        >
          <label className="profile-field">
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          {emailMode !== "reset" ? (
            <label className="profile-field">
              <span>Mot de passe</span>
              <input
                type="password"
                autoComplete={
                  emailMode === "register" ? "new-password" : "current-password"
                }
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                minLength={6}
              />
            </label>
          ) : null}
          <button
            type="submit"
            className="profile-onboarding-submit"
            disabled={busy}
          >
            {busy
              ? "…"
              : emailMode === "register"
                ? "Créer un compte"
                : emailMode === "reset"
                  ? "Envoyer le lien"
                  : "Se connecter"}
          </button>
        </form>

        <div className="sign-in-email-links">
          {emailMode === "signin" ? (
            <>
              <button
                type="button"
                className="profile-onboarding-cancel"
                disabled={busy}
                onClick={() => switchMode("register")}
              >
                Créer un compte
              </button>
              <button
                type="button"
                className="profile-onboarding-cancel"
                disabled={busy}
                onClick={() => switchMode("reset")}
              >
                Mot de passe oublié ?
              </button>
            </>
          ) : (
            <button
              type="button"
              className="profile-onboarding-cancel"
              disabled={busy}
              onClick={() => switchMode("signin")}
            >
              Retour à la connexion
            </button>
          )}
        </div>

        <button type="button" className="profile-onboarding-cancel" onClick={onClose}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
