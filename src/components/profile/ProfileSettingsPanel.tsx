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
import { BibleFontSizeSlider } from "../BibleFontSizeSlider";
import { AccountSettingsSection } from "./AccountSettingsSection";
import {
  ProfileAboutSection,
  type ProfileAppUpdates,
} from "./ProfileAboutSection";
import { ProfileHeader } from "./ProfileHeader";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SyncSettingsGroup } from "./SyncSettingsGroup";

export type ProfilePrefsTab =
  | "appearance"
  | "bible"
  | "reading"
  | "library"
  | "about";

export type ProfileSettingsPanelProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onSetTheme: (pref: ThemePref) => void;
  onRequestSignIn?: () => void;
  readingChrome?: ProfileReadingChrome | null;
  onOpenHistory?: () => void;
  onOpenMarks?: () => void;
  /** Aba inicial ao montar (ex. retorno do histórico → library). */
  initialPrefsTab?: ProfilePrefsTab;
  /** Instalar / atualizar (persistente em À propos). */
  appUpdates?: ProfileAppUpdates | null;
};

type PrefsTab = ProfilePrefsTab;

const PREFS_TABS: readonly {
  id: PrefsTab;
  labelKey:
    | "profile.appearance"
    | "profile.group.bible"
    | "profile.group.reading"
    | "profile.group.library"
    | "profile.group.about";
}[] = [
  { id: "appearance", labelKey: "profile.appearance" },
  { id: "bible", labelKey: "profile.group.bible" },
  { id: "reading", labelKey: "profile.group.reading" },
  { id: "library", labelKey: "profile.group.library" },
  { id: "about", labelKey: "profile.group.about" },
];

/**
 * Ecrã Profil: header + prefs; ícone settings abre a secção Compte.
 * O resto das prefs usa abas com estado ativo.
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
  initialPrefsTab = "appearance",
  appUpdates = null,
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
  const [prefsTab, setPrefsTab] = useState<PrefsTab>(initialPrefsTab);
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  const markedCount = useMemo(() => {
    void activityTick;
    return countMarkedVerses();
  }, [activityTick]);

  const guest =
    session.status === "anonymous" || session.status === "offline_guest";
  const showQuota = guest && markedCount >= 7;
  const quotaPct = Math.min((markedCount / FREE_MARK_QUOTA) * 100, 100);
  const chromeReady = Boolean(readingChrome);

  useEffect(() => {
    if (!active) {
      setAccountOpen(false);
      return;
    }
    /* Convidado: sem secção Compte (o header mostra « Se connecter »). */
    if (guest) setAccountOpen(false);
    let cancelled = false;
    void (async () => {
      const health = await getStorageHealth();
      if (cancelled) return;
      setStorageHealth(health);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, activityTick, guest]);

  useEffect(() => {
    function syncOnline() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

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

  const activeTabMeta =
    PREFS_TABS.find((tab) => tab.id === prefsTab) ?? PREFS_TABS[0]!;

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
        onOpenSettings={
          guest ? undefined : () => setAccountOpen((open) => !open)
        }
        /* Convidado: « Se connecter » no lugar da engrenagem. */
        onSignIn={guest ? onRequestSignIn : undefined}
        signInDisabled={loading || !online}
      />

      <div className="profile-settings-groups">
        {guest && !online ? (
          <p className="profile-guest-offline" role="alert">
            {t("auth.offlineRequired")}
          </p>
        ) : null}
        {!guest && accountOpen ? (
          <>
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
            <SyncSettingsGroup />
          </>
        ) : (
          <>
            <div
              className="profile-settings-tabs"
              role="tablist"
              aria-label={t("profile.settings")}
            >
              {PREFS_TABS.map((tab) => {
                const selected = prefsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`profile-tab-${tab.id}`}
                    className={`profile-settings-tab${selected ? " is-active" : ""}`}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setPrefsTab(tab.id)}
                  >
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>

            <div
              key={prefsTab}
              className="profile-settings-tabpanel"
              role="tabpanel"
              id={`profile-panel-${prefsTab}`}
              aria-labelledby={`profile-tab-${prefsTab}`}
            >
              {prefsTab === "appearance" ? (
                <SettingsGroup title={t(activeTabMeta.labelKey)}>
                  <div className="settings-row is-static">
                    <YvIcon
                      name="routine"
                      className="settings-row-icon"
                      opsz={20}
                    />
                    <span className="settings-row-body">
                      <span className="settings-row-label">
                        {t("profile.theme")}
                      </span>
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
                        className={
                          themePref === "system" ? "is-active" : undefined
                        }
                        onClick={() => onSetTheme("system")}
                      >
                        {t("profile.themeSystem")}
                      </button>
                    </div>
                  </div>
                </SettingsGroup>
              ) : null}

              {prefsTab === "bible" ? (
                <SettingsGroup title={t(activeTabMeta.labelKey)}>
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
                            readingChrome?.textVersion === version.id
                              ? " is-on"
                              : ""
                          }${
                            readingChrome?.htCatalogLoading &&
                            version.id === "ht98"
                              ? " is-busy"
                              : ""
                          }`}
                          disabled={
                            !chromeReady ||
                            (Boolean(readingChrome?.htCatalogLoading) &&
                              version.id === "ht98")
                          }
                          aria-pressed={
                            readingChrome?.textVersion === version.id
                          }
                          title={version.title}
                          onClick={() =>
                            readingChrome?.switchTextVersion(version.id)
                          }
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
              ) : null}

              {prefsTab === "reading" ? (
                <SettingsGroup title={t(activeTabMeta.labelKey)}>
                  <div className="settings-row is-static profile-font-row">
                    <YvIcon
                      name="settings"
                      className="settings-row-icon"
                      opsz={20}
                    />
                    <div className="settings-row-body profile-font-slider-wrap">
                      <BibleFontSizeSlider
                        embed
                        value={readingChrome?.fontSize ?? 19}
                        disabled={!chromeReady || !readingChrome}
                        onChange={(size) => readingChrome?.setFontSize(size)}
                      />
                    </div>
                  </div>
                  {!chromeReady ? (
                    <p className="settings-hint muted">
                      {t("profile.readingChromeHint")}
                    </p>
                  ) : null}
                </SettingsGroup>
              ) : null}

              {prefsTab === "library" ? (
                <>
                  {/* Sem título « Bibliothèque » duplicado sob a pill; linhas planas. */}
                  <SettingsGroup>
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
              ) : null}

              {prefsTab === "about" ? (
                <ProfileAboutSection appUpdates={appUpdates} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
