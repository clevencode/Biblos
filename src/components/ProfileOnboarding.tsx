import { useId, useState, type FormEvent } from "react";
import { joinFullName, splitFullName } from "../userProfile";

type ProfileOnboardingProps = {
  onComplete: (input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) => void;
};

export function ProfileOnboarding({ onComplete }: ProfileOnboardingProps) {
  const formId = useId();
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const { firstName, lastName } = splitFullName(fullName);
    if (!firstName) {
      setError("Indique ton nom complet pour continuer.");
      return;
    }
    setError(null);
    onComplete({
      firstName,
      lastName,
      preferredName: joinFullName(firstName, lastName),
    });
  }

  return (
    <div className="profile-onboarding" role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`}>
      <div className="profile-onboarding-card">
        <p className="profile-onboarding-brand">Biblos</p>
        <h1 id={`${formId}-title`} className="profile-onboarding-title type-title">
          Bienvenue
        </h1>
        <p className="profile-onboarding-lead muted">
          Quel est ton nom ? Ton activité sera liée à un identifiant privé, pas
          à ton nom.
        </p>

        <form className="profile-onboarding-form" onSubmit={submit}>
          <label className="profile-field">
            <span>Nom complet</span>
            <input
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={128}
              autoFocus
              placeholder="Ex. Alex Dupont"
            />
          </label>
          {error ? <p className="profile-onboarding-error">{error}</p> : null}
          <button type="submit" className="profile-onboarding-submit">
            Continuer
          </button>
        </form>
      </div>
    </div>
  );
}
