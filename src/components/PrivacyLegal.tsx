import { useId, useState } from "react";
import { enableDefaultNotificationPrefs } from "../notificationPrefs";

const PRIVACY_ACK_KEY = "biblos-privacy-ack-v1";

export function hasPrivacyAck(): boolean {
  try {
    return localStorage.getItem(PRIVACY_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePrivacyAck(): void {
  try {
    localStorage.setItem(PRIVACY_ACK_KEY, "1");
  } catch {
    /* private mode */
  }
  enableDefaultNotificationPrefs();
}

/** Textes juridiques (prototype) — FR, ton non technique. */
export function PrivacyPolicyPanels() {
  return (
    <>
      <details className="profile-legal">
        <summary className="profile-legal-summary">Confidentialité des données</summary>
        <div className="profile-legal-body">
          <p>
            Biblos est en <strong>phase de test / prototype</strong>. Les données
            que tu confies à l’app servent uniquement à faire fonctionner la
            lecture, les plans, les flashcards et ton profil.
          </p>
          <p>Nous pouvons enregistrer notamment :</p>
          <ul>
            <li>ton nom complet et identifiant local ;</li>
            <li>progression de lecture et notes du jour ;</li>
            <li>versets marqués et flashcards ;</li>
            <li>messages que tu envoies à l’équipe via « Contacter l’admin ».</li>
          </ul>
          <p>
            Ces informations restent dans un <strong>espace privé</strong> du
            prototype (appareil + synchronisation technique du projet).{" "}
            <strong>Elles ne sont pas vendues ni communiquées à des tiers</strong>{" "}
            à des fins commerciales ou publicitaires.
          </p>
          <p>
            Comme il s’agit d’un test, les contenus peuvent être réinitialisés
            ou effacés pendant le développement. Pour une question ou une
            demande liée à tes données, utilise « Contacter l’admin ».
          </p>
        </div>
      </details>

      <details className="profile-legal">
        <summary className="profile-legal-summary">Cookies et stockage local</summary>
        <div className="profile-legal-body">
          <p>
            Biblos <strong>n’utilise pas de cookies publicitaires</strong> ni de
            traceurs marketing. L’app s’appuie surtout sur le{" "}
            <strong>stockage local</strong> de ton appareil (préférences, thème,
            progression, brouillons) pour garder ton expérience entre deux
            sessions.
          </p>
          <p>
            Ce stockage est nécessaire au fonctionnement du prototype (se
            souvenir de toi, de ton plan et de tes cartes). Tu peux l’effacer en
            vidant les données du site / de l’app dans les réglages du
            navigateur ou du système.
          </p>
          <p>
            L’app est configurée pour <strong>ne pas être indexée</strong> par
            les moteurs de recherche pendant la phase de test.
          </p>
        </div>
      </details>
    </>
  );
}

/**
 * Écran d’entrée obligatoire : cocher « J’accepte » pour continuer.
 */
export function PrivacyEntryGate({ onAccepted }: { onAccepted: () => void }) {
  const formId = useId();
  const [accepted, setAccepted] = useState(false);

  return (
    <div
      className="privacy-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
    >
      <div className="privacy-gate-card">
        <p className="privacy-gate-brand">Biblos</p>
        <h1 id={`${formId}-title`} className="privacy-gate-title type-title">
          Confidentialité
        </h1>
        <p className="privacy-gate-lead muted">
          Prototype en phase de test. Tes données restent privées et ne sont
          pas partagées avec des tiers. Elles servent uniquement à l’app.
        </p>

        <div className="privacy-gate-policies">
          <PrivacyPolicyPanels />
        </div>

        <label className="privacy-gate-check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            J’accepte la confidentialité des données, l’usage du stockage local
            et les notifications de l’app (verset du jour, rappel de plan,
            informations) — modifiables plus tard dans Réglages.
          </span>
        </label>

        <button
          type="button"
          className="privacy-gate-btn"
          disabled={!accepted}
          onClick={() => {
            if (!accepted) return;
            savePrivacyAck();
            onAccepted();
          }}
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
