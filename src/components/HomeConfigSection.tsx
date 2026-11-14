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

type HomeConfigSectionProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onSetTheme: (pref: "light" | "dark") => void;
  onRequestSignIn?: () => void;
};

/**
 * Config app na Home (ex-Profil): conta, idioma/tema, saúde do storage, admin.
 * Experiência de leitura (histórico, surlignages, offline Bíblia) fica no leitor.
 */
export function HomeConfigSection({
  active,
  activityTick,
  themePref,
  onSetTheme,
  onRequestSignIn,
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

  useEffect(() => {
    setFullName(joinFullName(profile.firstName, profile.lastName));
  }, [profile.firstName, profile.lastName]);

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

  return (
    <div className="home-config">
      <section className="home-section" aria-labelledby="home-config-account-title">
        <div className="home-section-head">
          <h2 id="home-config-account-title" className="home-section-title">
            {t("profile.account")}
          </h2>
        </div>
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
      </section>

      <section className="home-section" aria-labelledby="home-config-prefs-title">
        <div className="home-section-head">
          <h2 id="home-config-prefs-title" className="home-section-title">
            {t("profile.settings")}
          </h2>
        </div>
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
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-config-storage-title">
        <div className="home-section-head">
          <h2 id="home-config-storage-title" className="home-section-title">
            {t("profile.storage")}
          </h2>
        </div>
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
      </section>

      {showAdminEntry ? (
        <section className="home-section" aria-labelledby="home-config-admin-title">
          <div className="home-section-head">
            <h2 id="home-config-admin-title" className="home-section-title">
              {t("profile.tab.admin")}
            </h2>
          </div>
          <AdminReadingPlansWorkspace
            embedded
            userEmail={user?.email ?? null}
          />
        </section>
      ) : null}
    </div>
  );
}
