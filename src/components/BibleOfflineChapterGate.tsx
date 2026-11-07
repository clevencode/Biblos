import { YvIcon } from "./YvIcon";

type BibleOfflineChapterGateProps = {
  onDownload: () => void;
  offlineBusy?: boolean;
};

export function BibleOfflineChapterGate({
  onDownload,
  offlineBusy = false,
}: BibleOfflineChapterGateProps) {
  return (
    <div className="bible-offline-chapter-gate" role="region" aria-labelledby="bible-offline-gate-title">
      <YvIcon name="cloud_download" className="bible-offline-chapter-gate-icon" />
      <h2 id="bible-offline-gate-title" className="bible-offline-chapter-gate-title">
        Chapitre hors ligne indisponible
      </h2>
      <p className="bible-offline-chapter-gate-lead bible-yv-muted">
        Ce chapitre doit être téléchargé pour une lecture sans connexion. Vos marques et
        l’avancement restent enregistrés sur l’appareil.
      </p>
      <button
        type="button"
        className="bible-yv-chip bible-offline-chapter-gate-cta"
        disabled={offlineBusy}
        onClick={onDownload}
      >
        {offlineBusy ? "Téléchargement…" : "Télécharger la Bible hors ligne"}
      </button>
    </div>
  );
}
