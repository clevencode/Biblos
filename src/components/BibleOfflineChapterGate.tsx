import { YvIcon } from "./YvIcon";

type BibleOfflineChapterGateProps = {
  onDownload: () => void;
  offlineBusy?: boolean;
  /** Sem rede e versão ainda não baixada — CTA educativo. */
  needsReconnect?: boolean;
};

export function BibleOfflineChapterGate({
  onDownload,
  offlineBusy = false,
  needsReconnect = false,
}: BibleOfflineChapterGateProps) {
  return (
    <div className="bible-offline-chapter-gate" role="region" aria-labelledby="bible-offline-gate-title">
      <YvIcon
        name={needsReconnect ? "sync" : "download"}
        className="bible-offline-chapter-gate-icon"
      />
      <h2 id="bible-offline-gate-title" className="bible-offline-chapter-gate-title">
        {needsReconnect
          ? "Connexion requise pour télécharger"
          : "Chapitre hors ligne indisponible"}
      </h2>
      <p className="bible-offline-chapter-gate-lead bible-yv-muted">
        {needsReconnect
          ? "Cette version n’est pas encore disponible hors ligne. Reconnectez-vous pour la télécharger ; ensuite la lecture et la recherche fonctionneront sans réseau."
          : "Ce chapitre doit être téléchargé pour une lecture sans connexion. Vos marques et l’avancement restent enregistrés sur l’appareil."}
      </p>
      <button
        type="button"
        className="bible-yv-chip bible-offline-chapter-gate-cta"
        disabled={offlineBusy || needsReconnect}
        onClick={onDownload}
      >
        {offlineBusy
          ? "Téléchargement…"
          : needsReconnect
            ? "En attente de connexion"
            : "Télécharger la Bible hors ligne"}
      </button>
    </div>
  );
}
