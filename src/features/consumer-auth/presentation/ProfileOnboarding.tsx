import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useUiLocale } from "../../../i18n/UiLocaleContext";
import { joinFullName, splitFullName } from "../../../userProfile";

type ProfileOnboardingProps = {
  onComplete: (input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) => void;
  /** Ferme sans enregistrer. */
  onCancel?: () => void;
  /** Préremplissage (ex. displayName Google). */
  initialFullName?: string;
};

export function ProfileOnboarding({
  onComplete,
  onCancel,
  initialFullName = "",
}: ProfileOnboardingProps) {
  const { t } = useUiLocale();
  const formId = useId();
  const titleId = `${formId}-title`;
  const cardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(initialFullName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.requestAnimationFrame(() => {
      nameRef.current?.focus();
    });

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (busy) return;
      if (!onCancel) return;
      event.preventDefault();
      onCancel();
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [busy, onCancel]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const raw = (fullName.trim() || nameRef.current?.value.trim() || "").trim();
    const { firstName, lastName } = splitFullName(raw);
    if (!firstName) {
      setError(t("onboarding.errorName"));
      nameRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    onComplete({
      firstName,
      lastName,
      preferredName: joinFullName(firstName, lastName),
    });
  }

  return createPortal(
    <div
      className="profile-onboarding"
      role="presentation"
    >
      {onCancel ? (
        <button
          type="button"
          className="profile-onboarding-backdrop"
          aria-label={t("common.close")}
          disabled={busy}
          onClick={onCancel}
        />
      ) : null}
      <div
        ref={cardRef}
        className="profile-onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <p className="profile-onboarding-brand">Biblos</p>
        <h1 id={titleId} className="profile-onboarding-title type-title">
          {t("onboarding.welcomeTitle")}
        </h1>
        <p className="profile-onboarding-lead muted">
          {t("onboarding.welcomeLead")}
        </p>

        <form className="profile-onboarding-form" onSubmit={submit}>
          <label className="profile-field">
            <span>{t("onboarding.fullName")}</span>
            <input
              ref={nameRef}
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (error) setError(null);
              }}
              maxLength={128}
              placeholder="Ex. Alex Dupont"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${formId}-error` : undefined}
            />
          </label>
          {error ? (
            <p
              id={`${formId}-error`}
              className="profile-onboarding-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="profile-onboarding-submit"
            disabled={busy}
          >
            {t("onboarding.submit")}
          </button>
          {onCancel ? (
            <button
              type="button"
              className="profile-onboarding-cancel"
              disabled={busy}
              onClick={onCancel}
            >
              {t("onboarding.cancel")}
            </button>
          ) : null}
        </form>
      </div>
    </div>,
    document.body,
  );
}
