import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { YvIcon } from "../../../components/YvIcon";
import { useUiLocale } from "../../../i18n/UiLocaleContext";
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

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SignInModal({
  open,
  title,
  lead,
  variant = "upgrade",
  onClose,
  onSignedIn,
}: SignInModalProps) {
  const { t } = useUiLocale();
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    error,
    clearError,
  } = useConsumerAuth();
  const formId = useId();
  const titleId = useId();
  const leadId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const googleBtnRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;

    const prev =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    restoreFocusRef.current = prev;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setEmailMode("signin");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setResetSent(false);
    setLocalError(null);
    setBusy(false);
    clearError();

    const focusTimer = window.requestAnimationFrame(() => {
      googleBtnRef.current?.focus();
    });

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (busyRef.current) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = cardRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const restore = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (restore && document.contains(restore)) {
        restore.focus();
      }
    };
  }, [open, onClose, clearError]);

  if (!open) return null;

  const resolvedTitle =
    title ??
    (variant === "soft_gate" ? t("auth.titleSoftGate") : t("auth.titleUpgrade"));
  const resolvedLead =
    lead ??
    (variant === "soft_gate" ? t("auth.leadSoftGate") : t("auth.leadUpgrade"));

  const displayError = localError || error;

  function requestClose() {
    if (busyRef.current) return;
    onClose();
  }

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
      setLocalError(t("auth.errorEmail"));
      return;
    }
    if (emailMode !== "reset" && password.length < 6) {
      setLocalError(t("auth.errorPassword"));
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

  const submitLabel =
    emailMode === "register"
      ? t("auth.register")
      : emailMode === "reset"
        ? t("auth.sendLink")
        : t("auth.signIn");

  return createPortal(
    <div className="sign-in-modal" role="presentation">
      <button
        type="button"
        className="profile-onboarding-backdrop"
        aria-label={t("common.close")}
        disabled={busy}
        onClick={requestClose}
      />
      <div
        ref={cardRef}
        className="profile-onboarding-card sign-in-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
      >
        <button
          type="button"
          className="sign-in-modal-close"
          aria-label={t("common.close")}
          disabled={busy}
          onClick={requestClose}
        >
          <YvIcon name="close" className="sign-in-modal-close-icon" />
        </button>

        <p className="profile-onboarding-brand">Biblos</p>
        <h2 id={titleId} className="profile-onboarding-title type-title">
          {resolvedTitle}
        </h2>
        <p id={leadId} className="profile-onboarding-lead muted">
          {resolvedLead}
        </p>
        {displayError ? (
          <p className="profile-onboarding-error" role="alert">
            {displayError}
          </p>
        ) : null}
        {resetSent ? (
          <p className="profile-onboarding-lead muted" role="status">
            {t("auth.resetSent")}
          </p>
        ) : null}

        <button
          ref={googleBtnRef}
          type="button"
          className="auth-google-btn"
          disabled={busy}
          aria-busy={busy}
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
          {t("auth.google")}
        </button>

        <div className="sign-in-divider" role="separator">
          <span>{t("auth.or")}</span>
        </div>

        <form
          id={formId}
          className="profile-onboarding-form"
          onSubmit={(e) => void handleEmailSubmit(e)}
        >
          <label className="profile-field">
            <span>{t("auth.email")}</span>
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
              <span>{t("auth.password")}</span>
              <span className="auth-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    emailMode === "register"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  minLength={6}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={
                    showPassword
                      ? t("auth.hidePassword")
                      : t("auth.showPassword")
                  }
                  aria-pressed={showPassword}
                  disabled={busy}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <YvIcon
                    name={showPassword ? "visibility_off" : "visibility"}
                    className="auth-password-toggle-icon"
                    opsz={20}
                  />
                </button>
              </span>
            </label>
          ) : null}
          <button
            type="submit"
            className="profile-onboarding-submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? t("common.loading") : submitLabel}
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
                {t("auth.createAccount")}
              </button>
              <button
                type="button"
                className="profile-onboarding-cancel"
                disabled={busy}
                onClick={() => switchMode("reset")}
              >
                {t("auth.forgotPassword")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="profile-onboarding-cancel"
              disabled={busy}
              onClick={() => switchMode("signin")}
            >
              {t("auth.backToSignIn")}
            </button>
          )}
        </div>

        <button
          type="button"
          className="profile-onboarding-cancel"
          disabled={busy}
          onClick={requestClose}
        >
          {t("auth.later")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
