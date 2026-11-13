import { YvIcon } from "./YvIcon";
import { useUiLocale } from "../i18n/UiLocaleContext";

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
  const { t } = useUiLocale();

  return (
    <div className="bible-offline-chapter-gate" role="region" aria-labelledby="bible-offline-gate-title">
      <YvIcon
        name={needsReconnect ? "sync" : "download"}
        className="bible-offline-chapter-gate-icon"
      />
      <h2 id="bible-offline-gate-title" className="bible-offline-chapter-gate-title">
        {needsReconnect ? t("offline.reconnectTitle") : t("offline.title")}
      </h2>
      <p className="bible-offline-chapter-gate-lead bible-yv-muted">
        {needsReconnect ? t("offline.reconnectLead") : t("offline.lead")}
      </p>
      <button
        type="button"
        className="bible-yv-chip bible-offline-chapter-gate-cta"
        disabled={offlineBusy || needsReconnect}
        onClick={onDownload}
      >
        {offlineBusy
          ? t("offline.downloading")
          : needsReconnect
            ? t("offline.waiting")
            : t("offline.downloadCta")}
      </button>
    </div>
  );
}
