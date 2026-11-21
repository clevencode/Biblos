import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { YvIcon } from "./YvIcon";
import {
  completeOnboarding,
  isClevencodeAdminEmail,
  joinFullName,
  preferredDisplayName,
  splitFullName,
} from "../userProfile";
import { resolveTheme, type ThemePref } from "../theme";
import { getStorageHealth, type StorageHealth } from "../offlineStorageGuard";
import { countMarkedVerses, FREE_MARK_QUOTA } from "../verseMarks";
import { useConsumerAuth } from "../features/consumer-auth";
import { downloadUserBackupJson } from "../features/user-sync";
import { AdminReadingPlansWorkspace } from "../features/reading-plans/presentation/admin/AdminReadingPlansWorkspace";
import { useUiLocale } from "../i18n/UiLocaleContext";
import { ACTIVITY_UI_ENABLED } from "../activityLog";
import { BIBLE_TEXT_VERSIONS } from "../bible/bibleVersions";
import type { ProfileReadingChrome } from "../bible/profileReadingChrome";

type ProfileTabId = "account" | "prefs" | "storage" | "admin";

type HomeConfigSectionProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onSetTheme: (pref: "light" | "dark") => void;
  onRequestSignIn?: () => void;
  readingChrome?: ProfileReadingChrome | null;
  onOpenHistory?: () => void;
  onOpenMarks?: () => void;
};

/**
 * Config app (ex-Profil): tabs Compte / Préfs / Stockage / Admin.
 * Préfs inclui versão, offline e atalhos Historique / Surlignages.
 */
export function HomeConfigSection({
  active,
  activityTick,
  themePref,
  onSetTheme,
  onRequestSignIn,
  readingChrome = null,
  onOpenHistory,
  onOpenMarks,
}: HomeConfigSectionProps) {
  const { t, locale, setLocaleWithBibleVersion } = useUiLocale();
  const {
    session,
    profile,
    user,
    signOut,
    deleteAccountAndData,
    refreshProfile,
    loading,
    isAuthenticated,
  } = useConsumerAuth();
  const showAdminEntry =
    isAuthenticated && isClevencodeAdminEmail(user?.email);

  const [activeTab, setActiveTab] = useState<ProfileTabId>("account");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState(() =>
    joinFullName(profile.firstName, profile.lastName),
  );
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const markedCount = useMemo(() => {
    void activityTick;
    return countMarkedVerses();
  }, [activityTick]);

  const resolvedTheme = resolveTheme(themePref);
  const guest =
    session.status === "anonymous" || session.status === "offline_guest";
  const showQuota = guest && markedCount >= 7;
  const quotaPct = Math.min((markedCount / FREE_MARK_QUOTA) * 100, 100);
  const displayName = preferredDisplayName(profile) || "…";
  const chromeReady = Boolean(readingChrome);

  useEffect(() => {
    setFullName(joinFullName(profile.firstName, profile.lastName));
  }, [profile.firstName, profile.lastName]);

  useEffect(() => {
    if (!showAdminEntry && activeTab === "admin") {
      setActiveTab("account");
    }
  }, [showAdminEntry, activeTab]);

  useEffect(() => {
    if (!active) return;
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

  function saveName(event: FormEvent) {
    event.preventDefault();
    const raw = (fullName.trim() || nameInputRef.current?.value.trim() || "").trim();
    const { firstName, lastName } = splitFullName(raw);
    if (!firstName) return;
    completeOnboarding({ firstName, lastName });
    refreshProfile();
    setEditingName(false);
  }

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
      setConfirmDelete(false);
    } finally {
      setDeleteBusy(false);
    }
  }

  const tabs: { id: ProfileTabId; label: string }[] = [
    { id: "account", label: t("profile.tab.account") },
    { id: "prefs", label: t("profile.tab.prefs") },
    { id: "storage", label: t("profile.tab.storage") },
    ...(showAdminEntry
      ? [{ id: "admin" as const, label: t("profile.tab.admin") }]
      : []),
  ];

  return (
    <div className="home-config">
      <nav className="profile-tabs" role="tablist" aria-label={t("profile.settings")}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`profile-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`profile-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={`profile-tab${selected ? " is-on" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="profile-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="profile-tab-panels">
        <div
          id="profile-panel-account"
          role="tabpanel"
          aria-labelledby="profile-tab-account"
          className="profile-tab-panel"
          hidden={activeTab !== "account"}
        >
          <div className="profile-card">
            {guest ? (
              <>
                <div className="profile-card-body">
                  <p className="profile-card-title">Sauvegarder mes études</p>
                  <p className="profile-card-lead">
                    Connecte Google pour synchroniser tes marques, notes et plans.
                  </p>
                  {showQuota ? (
                    <div className="profile-quota">
                      <div className="profile-quota-bar" aria-hidden="true">
                        <div
                          className="profile-quota-fill"
                          style={{ width: `${quotaPct}%` }}
                        />
                      </div>
                      <p className="profile-quota-label">
                        {markedCount}/{FREE_MARK_QUOTA} surlignages — relie un compte
                        pour continuer sereinement
                      </p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="profile-pill-cta"
                    disabled={loading}
                    onClick={() => onRequestSignIn?.()}
                  >
                    {t("profile.connectAccount")}
                  </button>
                </div>
                <div className="profile-card-footer">
                  <button
                    type="button"
                    className="profile-inset-row"
                    onClick={() =>
                      downloadUserBackupJson(
                        `biblos-backup-${new Date().toISOString().slice(0, 10)}.json`,
                      )
                    }
                  >
                    <YvIcon name="download" className="profile-row-icon" opsz={20} />
                    <span className="profile-row-body">
                      <span className="profile-row-label">Exporter backup (JSON)</span>
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="profile-card-rows">
                {editingName ? (
                  <form className="profile-name-edit" onSubmit={saveName}>
                    <label className="profile-field">
                      <span>Nom complet</span>
                      <input
                        ref={nameInputRef}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        maxLength={128}
                        autoComplete="name"
                        autoFocus
                      />
                    </label>
                    <div className="profile-delete-actions">
                      <button
                        type="button"
                        className="is-cancel"
                        onClick={() => {
                          setFullName(
                            joinFullName(profile.firstName, profile.lastName),
                          );
                          setEditingName(false);
                        }}
                      >
                        Annuler
                      </button>
                      <button type="submit" className="profile-save-btn">
                        Enregistrer
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="profile-inset-row"
                    onClick={() => setEditingName(true)}
                  >
                    <YvIcon name="person" className="profile-row-icon" opsz={20} />
                    <span className="profile-row-body">
                      <span className="profile-row-label">{displayName}</span>
                      <span className="profile-row-value muted">
                        {profile.email || "Compte connecté"}
                      </span>
                    </span>
                    <YvIcon name="settings" className="profile-row-chevron" opsz={20} />
                  </button>
                )}
                {!confirmSignOut ? (
                  <button
                    type="button"
                    className="profile-inset-row"
                    disabled={signOutBusy}
                    onClick={() => setConfirmSignOut(true)}
                  >
                    <YvIcon name="close" className="profile-row-icon" opsz={20} />
                    <span className="profile-row-body">
                      <span className="profile-row-label">{t("profile.signOut")}</span>
                    </span>
                  </button>
                ) : (
                  <div className="profile-delete-panel">
                    <p>{t("auth.signOutConfirm")}</p>
                    {typeof navigator !== "undefined" && !navigator.onLine ? (
                      <p>{t("auth.signOutConfirmOffline")}</p>
                    ) : null}
                    <div className="profile-delete-actions">
                      <button
                        type="button"
                        className="is-cancel"
                        disabled={signOutBusy}
                        onClick={() => setConfirmSignOut(false)}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        className="is-confirm"
                        disabled={signOutBusy}
                        onClick={() => {
                          setConfirmSignOut(false);
                          void handleSignOut();
                        }}
                      >
                        {t("auth.signOutConfirmAction")}
                      </button>
                    </div>
                  </div>
                )}
                {!confirmDelete ? (
                  <button
                    type="button"
                    className="profile-inset-row is-danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <YvIcon name="delete" className="profile-row-icon" opsz={20} />
                    <span className="profile-row-body">
                      <span className="profile-row-label">Supprimer mon compte</span>
                    </span>
                  </button>
                ) : (
                  <div className="profile-delete-panel">
                    <p>
                      Les bibles S21/HT98 resteront sur l&apos;appareil. Tes données
                      cloud et locales personnelles seront effacées.
                    </p>
                    <div className="profile-delete-actions">
                      <button
                        type="button"
                        className="is-cancel"
                        disabled={deleteBusy}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="is-confirm"
                        disabled={deleteBusy}
                        onClick={() => void handleDeleteConfirm()}
                      >
                        Confirmer la suppression
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          id="profile-panel-prefs"
          role="tabpanel"
          aria-labelledby="profile-tab-prefs"
          className="profile-tab-panel"
          hidden={activeTab !== "prefs"}
        >
          <div className="profile-card profile-card-rows">
            <div className="profile-inset-row profile-inset-static">
              <span className="profile-row-body">
                <span className="profile-row-label">{t("profile.language")}</span>
              </span>
              <div
                className="profile-theme-seg"
                role="group"
                aria-label={t("profile.language")}
              >
                <button
                  type="button"
                  className={locale === "fr" ? "is-active" : undefined}
                  onClick={() => setLocaleWithBibleVersion("fr")}
                >
                  {t("profile.langFr")}
                </button>
                <button
                  type="button"
                  className={locale === "ht" ? "is-active" : undefined}
                  onClick={() => setLocaleWithBibleVersion("ht")}
                >
                  {t("profile.langHt")}
                </button>
              </div>
            </div>
            <div className="profile-inset-row profile-inset-static">
              <span className="profile-row-body">
                <span className="profile-row-label">{t("profile.appearance")}</span>
              </span>
              <div
                className="profile-theme-seg"
                role="group"
                aria-label={t("profile.theme")}
              >
                <button
                  type="button"
                  className={resolvedTheme === "light" ? "is-active" : undefined}
                  onClick={() => onSetTheme("light")}
                >
                  {t("profile.themeLight")}
                </button>
                <button
                  type="button"
                  className={resolvedTheme === "dark" ? "is-active" : undefined}
                  onClick={() => onSetTheme("dark")}
                >
                  {t("profile.themeDark")}
                </button>
              </div>
            </div>

            <div
              className="bible-yv-tools-version"
              role="group"
              aria-label={t("bible.versionGroup")}
            >
              <span className="bible-yv-tools-version-label">{t("bible.version")}</span>
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
                    onClick={() =>
                      readingChrome?.switchTextVersion(version.id)
                    }
                  >
                    {version.abbreviation}
                  </button>
                ))}
              </div>
            </div>
            {readingChrome?.htCatalogError ? (
              <p className="bible-yv-tools-version-msg" role="alert">
                {readingChrome.htCatalogError}
              </p>
            ) : null}

            {!readingChrome?.offlineHidden ? (
              <button
                type="button"
                className={`profile-inset-row${
                  readingChrome?.versionOfflineReady ? " is-ready" : ""
                }${readingChrome?.offlineBusy ? " is-busy" : ""}`}
                disabled={!chromeReady}
                onClick={() => readingChrome?.toggleOfflineBible()}
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
              >
                {readingChrome?.versionOfflineReady ? (
                  <YvIcon
                    name="check_circle"
                    filled
                    className="profile-row-icon"
                    opsz={20}
                  />
                ) : (
                  <YvIcon name="download" className="profile-row-icon" opsz={20} />
                )}
                <span className="profile-row-body">
                  <span className="profile-row-label">
                    {readingChrome?.offlineBusy
                      ? t("bible.offlineDownloading", {
                          done: readingChrome.offlineProgress?.done ?? 0,
                          total:
                            readingChrome.offlineProgress?.total ??
                            (readingChrome.textVersion === "ht98" ? 2 : 66),
                        })
                      : readingChrome?.versionOfflineReady
                        ? t("bible.offlineReady")
                        : t("bible.offlineDownload")}
                  </span>
                </span>
              </button>
            ) : null}

            {ACTIVITY_UI_ENABLED ? (
              <button
                type="button"
                className="profile-inset-row"
                onClick={() => onOpenHistory?.()}
              >
                <YvIcon name="history" className="profile-row-icon" opsz={20} />
                <span className="profile-row-body">
                  <span className="profile-row-label">{t("history.title")}</span>
                </span>
                <YvIcon name="chevron_right" className="profile-row-chevron" opsz={20} />
              </button>
            ) : null}
            <button
              type="button"
              className="profile-inset-row"
              onClick={() => onOpenMarks?.()}
            >
              <YvIcon name="style" className="profile-row-icon" opsz={20} />
              <span className="profile-row-body">
                <span className="profile-row-label">{t("profile.marks")}</span>
              </span>
              <YvIcon name="chevron_right" className="profile-row-chevron" opsz={20} />
            </button>
          </div>
        </div>

        <div
          id="profile-panel-storage"
          role="tabpanel"
          aria-labelledby="profile-tab-storage"
          className="profile-tab-panel"
          hidden={activeTab !== "storage"}
        >
          <div className="profile-card profile-card-rows">
            <div className="profile-inset-row profile-inset-static" role="status">
              <span className="profile-row-body">
                <span className="profile-row-label">
                  {storageHealth
                    ? `${storageHealth.usedMB} Mo`
                    : t("profile.calculating")}
                </span>
                <span className="profile-row-value muted">
                  {storageHealth
                    ? storageHealth.isPersisted
                      ? t("profile.storage")
                      : "Cache"
                    : "…"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {showAdminEntry ? (
          <div
            id="profile-panel-admin"
            role="tabpanel"
            aria-labelledby="profile-tab-admin"
            className="profile-tab-panel profile-tab-panel--admin"
            hidden={activeTab !== "admin"}
          >
            <AdminReadingPlansWorkspace
              embedded
              userEmail={user?.email ?? null}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
