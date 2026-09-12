import { useId, useState, type FormEvent } from "react";

type ProfileOnboardingProps = {
  onComplete: (input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) => void;
};

export function ProfileOnboarding({ onComplete }: ProfileOnboardingProps) {
  const formId = useId();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) {
      setError("Indique ton prénom pour continuer.");
      return;
    }
    setError(null);
    onComplete({
      firstName: first,
      lastName: last,
      preferredName: preferredName.trim() || first,
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
          Comment veux-tu être appelé ? Ton activité sera liée à un identifiant
          privé, pas à ton nom.
        </p>

        <form className="profile-onboarding-form" onSubmit={submit}>
          <label className="profile-field">
            <span>Prénom</span>
            <input
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              maxLength={64}
              autoFocus
            />
          </label>
          <label className="profile-field">
            <span>Nom</span>
            <input
              name="lastName"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={64}
            />
          </label>
          <label className="profile-field">
            <span>Nom préféré</span>
            <input
              name="preferredName"
              autoComplete="nickname"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder={firstName.trim() || "Ex. Alex"}
              maxLength={64}
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
