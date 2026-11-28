import { useEffect, useMemo, useState } from "react";
import { YvIcon } from "../YvIcon";
import type { ThemePref } from "../../theme";
import { countMarkedVerses, FREE_MARK_QUOTA } from "../../verseMarks";
import { useConsumerAuth } from "../../features/consumer-auth";
import { useUiLocale } from "../../i18n/UiLocaleContext";
import { AccountSettingsSection } from "./AccountSettingsSection";
import {
  ProfileAboutSection,
  type ProfileAppUpdates,
} from "./ProfileAboutSection";
import { ProfileHeader } from "./ProfileHeader";
import { SettingsGroup } from "./SettingsGroup";
import { StorageSettingsPanel } from "./StorageSettingsPanel";
import { SyncSettingsGroup } from "./SyncSettingsGroup";

export type ProfilePrefsTab = "appearance" | "storage" | "about";

export type ProfileSettingsPanelProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onSetTheme: (pref: ThemePref) => void;
  onRequestSignIn?: () => void;
  /** Instalar / atualizar (persistente em À propos). */
  appUpdates?: ProfileAppUpdates | null;
};

type PrefsTab = ProfilePrefsTab;

const PREFS_TABS: readonly {
  id: PrefsTab;
  labelKey:
    | "profile.appearance"
    | "profile.tab.storage"
    | "profile.group.about";
}[] = [
  { id: "appearance", labelKey: "profile.appearance" },
  { id: "storage", labelKey: "profile.tab.storage" },
  { id: "about", labelKey: "profile.group.about" },
];

/**
 * Ecrã Profil: header + prefs; ícone settings abre a secção Compte.
 * O resto das prefs usa abas com estado ativo (Aparência, Stockage, À propos).
 * Versão, offline, tamanho da letra, histórico e marcas vivem no menu do leitor.
 * Entry canónico: `#panel-account`.
 */
export function ProfileSettingsPanel({
  active,
  activityTick,
  themePref,
  onSetTheme,
  onRequestSignIn,
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

  const [signOutBusy, setSignOutBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [prefsTab, setPrefsTab] = useState<PrefsTab>("appearance");
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

  useEffect(() => {
    if (!active) {
      setAccountOpen(false);
      return;
    }
    /* Convidado: sem secção Compte (o header mostra « Se connecter »). */
    if (guest) setAccountOpen(false);
  }, [active, guest]);

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

              {prefsTab === "storage" ? (
                <StorageSettingsPanel active={active} />
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
