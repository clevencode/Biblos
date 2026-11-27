import { useCallback, useEffect, useState } from "react";
import { useUiLocale } from "../../i18n/UiLocaleContext";
import {
  clearReadingCache,
  formatBytes,
  protectStorage,
  readStorageReport,
  type StorageReport,
} from "../../storage/storageControl";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

type StorageSettingsPanelProps = {
  active: boolean;
};

/**
 * Profil › Stockage: uso, detalhe, Bíblias offline, proteção e limpeza do
 * cache de leitura (sem tocar em dados pessoais).
 */
export function StorageSettingsPanel({ active }: StorageSettingsPanelProps) {
  const { t, dateLocale } = useUiLocale();
  const [report, setReport] = useState<StorageReport | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState<"clear" | "protect" | null>(null);
  const [cleared, setCleared] = useState(false);

  const refresh = useCallback(async () => {
    setReport(await readStorageReport());
  }, []);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  const size = (bytes: number | null | undefined) =>
    bytes == null ? "…" : bytes <= 0 ? "—" : formatBytes(bytes, dateLocale);

  const used = report?.usedBytes ?? null;
  const quota = report?.quotaBytes ?? null;
  const pct =
    used != null && quota ? Math.min(100, Math.max(1, (used / quota) * 100)) : 0;

  async function onClear() {
    setBusy("clear");
    try {
      await clearReadingCache();
      setCleared(true);
    } finally {
      setBusy(null);
      setConfirmClear(false);
      await refresh();
      /* O navegador atualiza o total usado com atraso: relê mais tarde. */
      window.setTimeout(() => void refresh(), 2000);
    }
  }

  async function onProtect() {
    setBusy("protect");
    try {
      await protectStorage();
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  return (
    <>
      <SettingsGroup title={t("profile.storage")}>
        <div className="settings-row is-static profile-storage-usage" role="status">
          <span className="settings-row-body">
            <span className="settings-row-label">
              {report
                ? t("storage.used", { used: size(used) })
                : t("profile.calculating")}
            </span>
            {quota ? (
              <span className="settings-row-value muted">
                {t("storage.ofQuota", { quota: size(quota) })}
              </span>
            ) : null}
            {quota ? (
              <span className="profile-quota-bar profile-storage-bar" aria-hidden>
                <span className="profile-quota-fill" style={{ width: `${pct}%` }} />
              </span>
            ) : null}
          </span>
        </div>
        {report?.cachesBytes != null ? (
          <SettingsRow
            icon="download"
            label={t("storage.offlineFiles")}
            value={size(report.cachesBytes)}
          />
        ) : null}
        {report?.indexedDbBytes != null ? (
          <SettingsRow
            icon="search"
            label={t("storage.appData")}
            value={size(report.indexedDbBytes)}
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t("storage.offlineTitle")}>
        <SettingsRow
          icon={report?.s21Books === report?.s21Total ? "check_circle" : "menu_book"}
          iconFilled={report?.s21Books === report?.s21Total}
          ready={report?.s21Books === report?.s21Total}
          label="Segond 21 (S21)"
          value={
            !report
              ? "…"
              : report.bundled
                ? t("storage.bundled")
                : t("storage.s21Books", {
                    n: report.s21Books,
                    total: report.s21Total,
                  })
          }
        />
        <SettingsRow
          icon={report?.ht98Ready ? "check_circle" : "menu_book"}
          iconFilled={Boolean(report?.ht98Ready)}
          ready={Boolean(report?.ht98Ready)}
          label="1998 Haïtienne (HAT98)"
          value={
            !report
              ? "…"
              : report.bundled
                ? t("storage.bundled")
                : report.ht98Ready
                  ? t("storage.ht98Ready")
                  : t("storage.ht98Missing")
          }
        />
        {report && !report.bundled ? (
          <p className="settings-hint muted profile-storage-hint">
            {t("storage.offlineHint")}
          </p>
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t("storage.manageTitle")}>
        {report && !report.bundled ? (
          report.persisted ? (
            <SettingsRow
              icon="check_circle"
              iconFilled
              ready
              label={t("storage.protected")}
              value={t("storage.protectedHint")}
            />
          ) : (
            <SettingsRow
              icon="cloud_off"
              label={t("storage.protect")}
              value={t("storage.unprotectedHint")}
              busy={busy === "protect"}
              disabled={!report.canPersist || busy != null}
              chevron
              onClick={() => void onProtect()}
            />
          )
        ) : null}

        {!confirmClear ? (
          <SettingsRow
            icon="delete"
            label={cleared ? t("storage.cleared") : t("storage.clearCache")}
            value={
              report?.readingCacheBytes
                ? t("storage.frees", { size: size(report.readingCacheBytes) })
                : t("storage.clearHint")
            }
            disabled={busy != null}
            onClick={() => {
              setCleared(false);
              setConfirmClear(true);
            }}
          />
        ) : (
          <div className="profile-delete-panel" role="alertdialog">
            <p>{t("storage.clearConfirm")}</p>
            <div className="profile-delete-actions">
              <button
                type="button"
                className="is-cancel"
                disabled={busy === "clear"}
                onClick={() => setConfirmClear(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="is-confirm"
                disabled={busy === "clear"}
                onClick={() => void onClear()}
              >
                {busy === "clear" ? t("common.loading") : t("storage.clearAction")}
              </button>
            </div>
          </div>
        )}
        <p className="settings-hint muted profile-storage-hint">
          {t("storage.personalSafe")}
        </p>
      </SettingsGroup>
    </>
  );
}
