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
function PrivacyDataBody() {
  return (
    <>
      <p>
        Biblos est en <strong>phase de test</strong>, partagée avec un petit
        groupe de personnes invitées (pas une app publique). Voici{" "}
        <strong>quelles données</strong> sont traitées et{" "}
        <strong>pourquoi</strong>.
      </p>

      <p>
        <strong>1. Profil (appareil + sync admin)</strong>
      </p>
      <ul>
        <li>
          <strong>Données :</strong> nom complet, identifiant technique local
          (UUID, stable même si tu changes de nom), dates de création /
          onboarding.
        </li>
        <li>
          <strong>Finalité :</strong> te reconnaître dans l’app, afficher ton
          profil, et permettre à l’administrateur du projet de savoir{" "}
          <em>qui</em> utilise l’app pendant le test.
        </li>
      </ul>

      <p>
        <strong>2. Temps passé dans l’app</strong>
      </p>
      <ul>
        <li>
          <strong>Données :</strong> minutes cumulées tant que l’app est ouverte
          au premier plan (pas de géolocalisation).
        </li>
        <li>
          <strong>Finalité :</strong> suivi d’usage pour l’admin (améliorer
          l’app, voir si le test est utilisé), synchronisé avec ton profil.
        </li>
      </ul>

      <p>
        <strong>3. Journal d’activité (sync admin, non affiché dans l’app)</strong>
      </p>
      <ul>
        <li>
          <strong>Données :</strong> événements liés à ton identifiant et ton
          nom — ouverture de l’app, création du profil, lecture biblique
          (livre / chapitre / verset), marquage de versets, création de
          flashcards, jours de plan lus, changement de thème, mise à jour du
          profil.
        </li>
        <li>
          <strong>Finalité :</strong> monitoring du test par l’admin (comprendre
          comment l’app est utilisée). Ces événements ne sont{" "}
          <strong>pas montrés</strong> dans ton interface ; ils partent vers
          l’espace technique privé du projet.
        </li>
      </ul>

      <p>
        <strong>4. Contenu de lecture (surtout sur ton appareil)</strong>
      </p>
      <ul>
        <li>
          <strong>Données :</strong> progression des plans, notes du jour,
          versets marqués, flashcards, préférences (thème, taille du texte,
          plan actif), Bible hors ligne si tu la télécharges, réglages de
          notifications.
        </li>
        <li>
          <strong>Finalité :</strong> faire fonctionner la lecture, les plans et
          les cartes sur <strong>cet appareil</strong>. Les notes personnelles
          restent locales. Les flashcards de versets créées par l’admin peuvent
          être synchronisées vers l’espace du projet ; celles des autres
          utilisateurs restent sur leur téléphone.
        </li>
      </ul>

      <p>
        <strong>5. Messages « Contacter l’admin »</strong>
      </p>
      <ul>
        <li>
          <strong>Données :</strong> catégorie (bug, suggestion, etc.), texte du
          message, ton nom affiché et ton identifiant.
        </li>
        <li>
          <strong>Finalité :</strong> répondre à ton aide, corriger des bugs ou
          prendre en compte tes retours — uniquement pour l’équipe du projet.
        </li>
      </ul>

      <p>
        <strong>6. Contenu partagé téléchargé (pas « collecté » sur toi)</strong>
      </p>
      <ul>
        <li>
          Plans de lecture, flashcards publiées et notifications in-app sont{" "}
          <strong>lus</strong> depuis l’espace technique du projet pour
          remplir le catalogue. Ce n’est pas un profil public : seuls les plans
          marqués pour tout le monde sont visibles ; certains plans restent
          réservés à l’admin.
        </li>
      </ul>

      <p>
        Ces informations restent dans un <strong>espace privé</strong>{" "}
        (ton appareil + synchronisation technique du projet pour le monitoring
        et le support).{" "}
        <strong>Elles ne sont pas vendues ni communiquées à des tiers</strong>{" "}
        à des fins commerciales ou publicitaires. Pas de cookies publicitaires
        ni de traceurs marketing.
      </p>
      <p>
        Comme il s’agit d’un test, les contenus peuvent être réinitialisés ou
        effacés pendant le développement. Tu peux supprimer les données de cet
        appareil via « Supprimer le compte » dans le profil. Pour une question
        ou une demande liée à tes données, utilise « Contacter l’admin ».
      </p>
    </>
  );
}

export function PrivacyPolicyPanels({
  showCookies = true,
}: {
  showCookies?: boolean;
} = {}) {
  return (
    <>
      <details className="profile-legal">
        <summary className="profile-legal-summary">Confidentialité des données</summary>
        <div className="profile-legal-body">
          <PrivacyDataBody />
        </div>
      </details>

      {showCookies ? (
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
              Ce stockage est nécessaire au fonctionnement de l’application (se
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
      ) : null}
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
        <div className="privacy-gate-scroll">
          <p className="privacy-gate-brand">Biblos</p>
          <h1 id={`${formId}-title`} className="privacy-gate-title type-title">
            Confidentialité
          </h1>
          <p className="privacy-gate-lead muted">
            Phase de test pour personnes invitées. Ci-dessous : quelles données
            sont traitées et à quelles fins. Pas de revente ni de publicité.
          </p>

          <article className="privacy-gate-article" aria-label="Confidentialité des données">
            <h2 className="privacy-gate-article-title">Confidentialité des données</h2>
            <div className="profile-legal-body privacy-gate-article-body">
              <PrivacyDataBody />
            </div>
          </article>
        </div>

        <div className="privacy-gate-footer">
          <label className="privacy-gate-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>
              J’accepte la confidentialité des données, l’usage du stockage
              local et les alertes téléphone (verset du jour, rappel de plan) —
              modifiables plus tard dans Réglages.
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
    </div>
  );
}
