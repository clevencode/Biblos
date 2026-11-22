import { useEffect, useMemo, useState } from "react";
import { YvIcon } from "../YvIcon";
import type { ThemePref } from "../../theme";
import { getStorageHealth, type StorageHealth } from "../../offlineStorageGuard";
import { countMarkedVerses, FREE_MARK_QUOTA } from "../../verseMarks";
import { useConsumerAuth } from "../../features/consumer-auth";
import { useUiLocale } from "../../i18n/UiLocaleContext";
import { ACTIVITY_UI_ENABLED } from "../../activityLog";
import { BIBLE_TEXT_VERSIONS } from "../../bible/bibleVersions";
import type { ProfileReadingChrome } from "../../bible/profileReadingChrome";
import { AccountSettingsSection } from "./AccountSettingsSection";
import { ProfileHeader } from "./ProfileHeader";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

export type ProfileSettingsPanelProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onSetTheme: (pref: ThemePref) => void;
  onRequestSignIn?: () => void;
  readingChrome?: ProfileReadingChrome | null;
  onOpenHistory?: () => void;
  onOpenMarks?: () => void;
};

/**
 * Ecrã Profil: header + prefs; ícone settings abre a secção Compte.
 * Entry canónico: `#panel-account`.
 */
export function ProfileSettingsPanel({
  active,
  activityTick,
  themePref,
  onSetTheme,
  onRequestSignIn,
  readingChrome = null,
  onOpenHistory,
  onOpenMarks,
}: ProfileSettingsPanelProps) {
  const { t } = useUiLocale();
  const {
    session,
    profile,
    signOut,
    deleteAccountAndData,
    refreshProfile,
    loading,
  } = useConsumerAuth();

  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const markedCount = useMemo(() => {
    void activityTick;
    return countMarkedVerses();
  }, [activityTick]);

  const guest =
    session.status === "anonymous" || session.status === "offline_guest";
  const showQuota = guest && markedCount >= 7;
  const quotaPct = Math.min((markedCount / FREE_MARK_QUOTA) * 100, 100);
  const chromeReady = Boolean(readingChrome);
  const fontSizeLabel = readingChrome
    ? Number.isInteger(readingChrome.fontSize)
      ? String(readingChrome.fontSize)
      : readingChrome.fontSize.toFixed(1)
    : "—";

  useEffect(() => {
    if (!active) {
      setAccountOpen(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const health = await getStorageHealth();
      if (cancelled) return;
      setStorageHealth(health);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, activityTick]);

  async function handleSignOut() {
    if (signOutBusy) return;
    setSignOutBusy(true);
    try {
      await signOut();
    } finally {
      setSignOutBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteAccountAndData();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div
      className={`profile-settings${accountOpen ? " is-account-open" : ""}`}
    >
      <ProfileHeader
        guest={guest}
        profile={profile}
        markedCount={markedCount}
        showQuota={showQuota}
        quotaPct={quotaPct}
        settingsOpen={accountOpen}
        onOpenSettings={() => setAccountOpen((open) => !open)}
      />

      <div className="profile-settings-groups">
        {accountOpen ? (
          <AccountSettingsSection
            guest={guest}
            loading={loading}
            profile={profile}
            signOutBusy={signOutBusy}
            deleteBusy={deleteBusy}
            onRequestSignIn={onRequestSignIn}
            onRefreshProfile={refreshProfile}
            onSignOut={() => void handleSignOut()}
            onDeleteAccount={() => void handleDeleteConfirm()}
          />
        ) : (
          <>
            <SettingsGroup title={t("profile.appearance")}>
              <div className="settings-row is-static">
                <YvIcon name="routine" className="settings-row-icon" opsz={20} />
                <span className="settings-row-body">
                  <span className="settings-row-label">{t("profile.theme")}</span>
                </span>
                <div
                  className="profile-theme-seg"
                  role="group"
                  aria-label={t("profile.theme")}
                >
                  <button
                    type="button"
                    className={themePref === "light" ? "is-active" : undefined}
                    onClick={() => onSetTheme("light")}
                  >
                    {t("profile.themeLight")}
                  </button>
                  <button
                    type="button"
                    className={themePref === "dark" ? "is-active" : undefined}
                    onClick={() => onSetTheme("dark")}
                  >
                    {t("profile.themeDark")}
                  </button>
                  <button
                    type="button"
                    className={themePref === "system" ? "is-active" : undefined}
                    onClick={() => onSetTheme("system")}
                  >
                    {t("profile.themeSystem")}
                  </button>
                </div>
              </div>
            </SettingsGroup>

            <SettingsGroup title={t("profile.group.bible")}>
              <div
                className="bible-yv-tools-version"
                role="group"
                aria-label={t("bible.versionGroup")}
              >
                <span className="bible-yv-tools-version-label">
                  {t("bible.version")}
                </span>
                <div className="bible-yv-tools-version-options">
                  {BIBLE_TEXT_VERSIONS.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      className={`bible-yv-tools-version-chip${
                        readingChrome?.textVersion === version.id ? " is-on" : ""
                      }${
                        readingChrome?.htCatalogLoading && version.id === "ht98"
                          ? " is-busy"
                          : ""
                      }`}
                      disabled={
                        !chromeReady ||
                        (Boolean(readingChrome?.htCatalogLoading) &&
                          version.id === "ht98")
                      }
                      aria-pressed={readingChrome?.textVersion === version.id}
                      title={version.title}
                      onClick={() => readingChrome?.switchTextVersion(version.id)}
                    >
                      {version.abbreviation}
                    </button>
                  ))}
                </div>
              </div>
              {!chromeReady ? (
                <p className="settings-hint muted">
                  {t("profile.readingChromeHint")}
                </p>
              ) : null}
              {readingChrome?.htCatalogError ? (
                <p className="bible-yv-tools-version-msg" role="alert">
                  {readingChrome.htCatalogError}
                </p>
              ) : null}
              {!readingChrome?.offlineHidden ? (
                <SettingsRow
                  icon={
                    readingChrome?.versionOfflineReady
                      ? "check_circle"
                      : "download"
                  }
                  iconFilled={Boolean(readingChrome?.versionOfflineReady)}
                  label={
                    readingChrome?.offlineBusy
                      ? t("bible.offlineDownloading", {
                          done: readingChrome.offlineProgress?.done ?? 0,
                          total:
                            readingChrome.offlineProgress?.total ??
                            (readingChrome.textVersion === "ht98" ? 2 : 66),
                        })
                      : readingChrome?.versionOfflineReady
                        ? t("bible.offlineReady")
                        : t("bible.offlineDownload")
                  }
                  disabled={!chromeReady}
                  ready={readingChrome?.versionOfflineReady}
                  busy={readingChrome?.offlineBusy}
                  aria-label={
                    readingChrome?.offlineBusy
                      ? t("bible.offlineBusy", {
                          done: readingChrome.offlineProgress?.done ?? 0,
                          total:
                            readingChrome.offlineProgress?.total ??
                            (readingChrome.textVersion === "ht98" ? 2 : 66),
                        })
                      : readingChrome?.versionOfflineReady
                        ? t("bible.offlineReady")
                        : t("bible.offlineDownload")
                  }
                  onClick={() => readingChrome?.toggleOfflineBible()}
                />
              ) : null}
            </SettingsGroup>

            <SettingsGroup title={t("profile.group.reading")}>
              <div className="settings-row is-static">
                <YvIcon name="settings" className="settings-row-icon" opsz={20} />
                <span className="settings-row-body">
                  <span className="settings-row-label">{t("bible.fontSize")}</span>
                </span>
                <div
                  className="profile-theme-seg profile-font-seg"
                  role="group"
                  aria-label={t("bible.fontSize")}
                >
                  <button
                    type="button"
                    disabled={
                      !chromeReady ||
                      (readingChrome != null &&
                        readingChrome.fontSize <= readingChrome.fontMin)
                    }
                    aria-label={t("bible.fontSmaller")}
                    onClick={() => readingChrome?.bumpFontSize(-0.5)}
                  >
                    A−
                  </button>
                  <span className="profile-font-size-value" aria-live="polite">
                    {fontSizeLabel}
                  </span>
                  <button
                    type="button"
                    disabled={
                      !chromeReady ||
                      (readingChrome != null &&
                        readingChrome.fontSize >= readingChrome.fontMax)
                    }
                    aria-label={t("bible.fontLarger")}
                    onClick={() => readingChrome?.bumpFontSize(0.5)}
                  >
                    A+
                  </button>
                </div>
              </div>
              {!chromeReady ? (
                <p className="settings-hint muted">
                  {t("profile.readingChromeHint")}
                </p>
              ) : null}
            </SettingsGroup>

            <SettingsGroup title={t("profile.group.library")}>
              {ACTIVITY_UI_ENABLED ? (
                <SettingsRow
                  icon="history"
                  label={t("history.title")}
                  chevron
                  onClick={() => onOpenHistory?.()}
                />
              ) : null}
              <SettingsRow
                icon="style"
                label={t("profile.marks")}
                chevron
                onClick={() => onOpenMarks?.()}
              />
            </SettingsGroup>

            <SettingsGroup title={t("profile.storage")}>
              <SettingsRow
                icon="desktop_windows"
                label={
                  storageHealth
                    ? `${storageHealth.usedMB} Mo`
                    : t("profile.calculating")
                }
                value={
                  storageHealth
                    ? storageHealth.isPersisted
                      ? t("profile.storage")
                      : t("profile.storageCache")
                    : "…"
                }
              />
            </SettingsGroup>
          </>
        )}
      </div>
    </div>
  );
}
