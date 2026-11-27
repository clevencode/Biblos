import { formatActivityWhen } from "../../activityLog";
import { syncUserDataNow, useSyncInfo } from "../../features/user-sync";
import { useUiLocale } from "../../i18n/UiLocaleContext";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/**
 * Profil › Compte › Synchronisation: o que é sincronizado entre dispositivos,
 * última sincronização e « Synchroniser maintenant ».
 */
export function SyncSettingsGroup() {
  const { t, dateLocale } = useUiLocale();
  const { status, lastSyncedAt } = useSyncInfo();
  const busy = status === "pending";
  const offline = status === "offline";

  const value = offline
    ? t("sync.offlineDetail")
    : busy
      ? t("sync.pending")
      : lastSyncedAt
        ? t("sync.lastSynced", { when: formatActivityWhen(lastSyncedAt, dateLocale) })
        : t("sync.never");

  return (
    <SettingsGroup title={t("sync.title")}>
      <SettingsRow
        icon={offline ? "cloud_off" : "sync"}
        label={t("sync.now")}
        value={value}
        busy={busy}
        disabled={busy || offline}
        onClick={() => void syncUserDataNow()}
      />
      <p className="settings-hint muted profile-sync-hint">{t("sync.scope")}</p>
    </SettingsGroup>
  );
}
