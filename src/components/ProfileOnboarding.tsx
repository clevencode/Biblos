import { useId, useRef, useState, type FormEvent } from "react";
import { joinFullName, splitFullName } from "../userProfile";

type ProfileOnboardingProps = {
  onComplete: (input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) => void;
  /** Ferme sans enregistrer (ex. Annuler depuis Marquer). */
  onCancel?: () => void;
  /** Contexte d’affichage — le nom n’est demandé qu’au moment de marquer. */
  variant?: "welcome" | "mark";
};

export function ProfileOnboarding({
  onComplete,
  onCancel,
  variant = "welcome",
}: ProfileOnboardingProps) {
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isMark = variant === "mark";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    // Autofill / IME : la valeur DOM peut être à jour alors que React ne l’est pas encore.
    const raw = (fullName.trim() || nameRef.current?.value.trim() || "").trim();
    const { firstName, lastName } = splitFullName(raw);
    if (!firstName) {
      setError("Indique ton nom complet pour continuer.");
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

  return (
    <div
      className={`profile-onboarding${isMark ? " is-mark-gate" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
    >
      {onCancel ? (
        <button
          type="button"
          className="profile-onboarding-backdrop"
          aria-label="Fermer"
          onClick={onCancel}
        />
      ) : null}
      <div className="profile-onboarding-card">
        <p className="profile-onboarding-brand">Biblos</p>
        <h1 id={`${formId}-title`} className="profile-onboarding-title type-title">
          {isMark ? "Marquer un verset" : "Bienvenue"}
        </h1>
        <p className="profile-onboarding-lead muted">
          {isMark
            ? "Pour enregistrer un surlignage, indique ton nom. Ton activité reste liée à un identifiant privé."
            : "Quel est ton nom ? Ton activité sera liée à un identifiant privé, pas à ton nom."}
        </p>

        <form className="profile-onboarding-form" onSubmit={submit}>
          <label className="profile-field">
            <span>Nom complet</span>
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
              autoFocus
              placeholder="Ex. Alex Dupont"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${formId}-error` : undefined}
            />
          </label>
          {error ? (
            <p id={`${formId}-error`} className="profile-onboarding-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="profile-onboarding-submit"
            disabled={busy}
          >
            {isMark ? "Marquer" : "Continuer"}
          </button>
          {onCancel ? (
            <button
              type="button"
              className="profile-onboarding-cancel"
              disabled={busy}
              onClick={onCancel}
            >
              Annuler
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
