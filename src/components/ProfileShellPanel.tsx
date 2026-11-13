import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { YvIcon } from "./YvIcon";
import {
  clearBibleReadingHistory,
  formatActivityWhen,
  listBibleReadingHistory,
} from "../activityLog";
import {
  completeOnboarding,
  isClevencodeAdminEmail,
  joinFullName,
  preferredDisplayName,
  splitFullName,
} from "../userProfile";
import { resolveTheme, type ThemePref } from "../theme";
import type { BibleHistorySelect } from "./BibleHistorySheet";
import {
  getStorageHealth,
  type StorageHealth,
} from "../offlineStorageGuard";
import {
  classifyOfflineDownloadError,
  clearVersionAvailabilityError,
  clearVersionDownloadProgress,
  resolveVersionAvailability,
  setVersionAvailabilityError,
  setVersionDownloadProgress,
  type VersionAvailabilityState,
} from "../bible/bibleVersionStatus";
import {
  countMarkedVerses,
  FREE_MARK_QUOTA,
  listAllVerseMarks,
} from "../verseMarks";
import { useConsumerAuth } from "../features/consumer-auth";
import { downloadUserBackupJson } from "../features/user-sync";
import { AdminReadingPlansWorkspace } from "../features/reading-plans/presentation/admin/AdminReadingPlansWorkspace";
import { downloadOfflineBible } from "../bibleOffline";
import { downloadHt1998Offline } from "../bible/ht1998Offline";
import { localS21Books } from "../bibleEngine";
import { useUiLocale } from "../i18n/UiLocaleContext";

type ProfileShellPanelProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onSetTheme: (pref: "light" | "dark") => void;
  onOpenPassage: (ref: BibleHistorySelect) => void;
  onHistoryChange?: () => void;
  onRequestSignIn?: () => void;
};

type ProfileContentTab = "account" | "prefs" | "storage" | "history" | "admin";

const PROFILE_CONTENT_TABS: {
  id: ProfileContentTab;
  labelKey:
    | "profile.tab.account"
    | "profile.tab.prefs"
    | "profile.tab.storage"
    | "profile.tab.history"
    | "profile.tab.admin";
  adminOnly?: boolean;
}[] = [
  { id: "account", labelKey: "profile.tab.account" },
  { id: "prefs", labelKey: "profile.tab.prefs" },
  { id: "storage", labelKey: "profile.tab.storage" },
  { id: "history", labelKey: "profile.tab.history" },
  { id: "admin", labelKey: "profile.tab.admin", adminOnly: true },
];

function isReady(state: VersionAvailabilityState | null): boolean {
  return state?.status === "offline_ready";
}

function isDownloading(state: VersionAvailabilityState | null): boolean {
  return state?.status === "downloading";
}

export function ProfileShellPanel({
  active,
  activityTick,
  themePref,
  onSetTheme,
  onOpenPassage,
  onHistoryChange,
  onRequestSignIn,
}: ProfileShellPanelProps) {
  const { t, dateLocale, locale, setLocaleWithBibleVersion } = useUiLocale();
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
  /** Link CMS só para o propriétaire autenticado — jamais para guest/anonymous. */
  const showAdminEntry =
    isAuthenticated && isClevencodeAdminEmail(user?.email);
  const [contentTab, setContentTab] = useState<ProfileContentTab>("account");
  const visibleTabs = useMemo(
    () =>
      PROFILE_CONTENT_TABS.filter((tab) => !tab.adminOnly || showAdminEntry),
    [showAdminEntry],
  );

  useEffect(() => {
    if (contentTab === "admin" && !showAdminEntry) {
      setContentTab("account");
    }
  }, [contentTab, showAdminEntry]);

  useEffect(() => {
    const el = document.getElementById(`profile-tab-${contentTab}`);
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [contentTab]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [s21Status, setS21Status] = useState<VersionAvailabilityState | null>(null);
  const [htStatus, setHtStatus] = useState<VersionAvailabilityState | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState(() =>
    joinFullName(profile.firstName, profile.lastName),
  );
  const nameInputRef = useRef<HTMLInputElement>(null);
  const clearTimerRef = useRef<number | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [dlBusy, setDlBusy] = useState<"s21" | "ht98" | null>(null);

  const markedCount = useMemo(() => {
    void activityTick;
    return countMarkedVerses();
  }, [activityTick]);

  const markedVerses = useMemo(() => {
    void activityTick;
    return listAllVerseMarks();
  }, [activityTick]);

  const history = useMemo(() => {
    void activityTick;
    return listBibleReadingHistory(profile.id, 12);
  }, [activityTick, profile.id]);

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
      const [health, s21, ht] = await Promise.all([
        getStorageHealth(),
        resolveVersionAvailability("s21"),
        resolveVersionAvailability("ht98"),
      ]);
      if (cancelled) return;
      setStorageHealth(health);
      setS21Status(s21);
      setHtStatus(ht);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, activityTick, dlBusy]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  function parseRef(event: (typeof history)[0]): BibleHistorySelect | null {
    const bookId = String(event.meta?.bookId || "").trim().toUpperCase();
    const chapterId = String(event.meta?.chapterId || "").trim();
    if (!bookId || !chapterId) return null;
    const verseRaw = event.meta?.verse;
    const verse =
      typeof verseRaw === "number" && Number.isFinite(verseRaw) ? verseRaw : null;
    const versionRaw = String(event.meta?.versionId || "s21").trim();
    const versionId = versionRaw === "ht98" ? "ht98" : "s21";
    return { versionId, bookId, chapterId, verse };
  }

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

  function requestClearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
        setConfirmClear(false);
        clearTimerRef.current = null;
      }, 4000);
      return;
    }
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    clearBibleReadingHistory(profile.id);
    setConfirmClear(false);
    onHistoryChange?.();
  }

  async function downloadVersion(id: "s21" | "ht98") {
    if (dlBusy) return;
    setDlBusy(id);
    clearVersionAvailabilityError(id);
    try {
      if (id === "ht98") {
        setVersionDownloadProgress("ht98", { done: 0, total: 2 });
        await downloadHt1998Offline((p) => {
          setVersionDownloadProgress("ht98", { done: p.done, total: p.total });
        });
        clearVersionDownloadProgress("ht98");
      } else {
        const list = localS21Books();
        setVersionDownloadProgress("s21", { done: 0, total: list.length || 66 });
        await downloadOfflineBible(list, (p) => {
          setVersionDownloadProgress("s21", { done: p.done, total: p.total });
        });
        clearVersionDownloadProgress("s21");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setVersionAvailabilityError(id, classifyOfflineDownloadError(err));
      }
      clearVersionDownloadProgress(id);
    } finally {
      setDlBusy(null);
      const [s21, ht] = await Promise.all([
        resolveVersionAvailability("s21"),
        resolveVersionAvailability("ht98"),
      ]);
      setS21Status(s21);
      setHtStatus(ht);
    }
  }

  const subtitle = isAuthenticated
    ? displayName
    : session.status === "offline_guest"
      ? "Mode hors ligne (cet appareil)"
      : "Études sur cet appareil";

  return (
    <div
      id="panel-profile"
      role="tabpanel"
      aria-labelledby="tab-profile"
      hidden={!active}
      className="pane-body profile-view"
    >
      <header className="profile-head">
        <div className="profile-head-copy">
          <h2 className="type-headline">{t("profile.title")}</h2>
          <p className="muted type-caption">{subtitle}</p>
        </div>
        <div className="profile-head-meta">
          {session.status === "offline_guest" ? (
            <YvIcon name="cloud_off" className="profile-row-icon" opsz={20} />
          ) : null}
          {session.status === "anonymous" ? (
            <YvIcon name="desktop_windows" className="profile-row-icon" opsz={20} />
          ) : null}
        </div>
      </header>

      <div className="profile-tabs" role="tablist" aria-label={t("profile.title")}>
        {visibleTabs.map((tab) => {
          const selected = contentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`profile-tab-${tab.id}`}
              className={`profile-tab${selected ? " is-on" : ""}`}
              aria-selected={selected}
              aria-controls={`profile-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setContentTab(tab.id)}
            >
              <span className="profile-tab-label">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="profile-tab-panels">
        <div
          id="profile-panel-account"
          role="tabpanel"
          aria-labelledby="profile-tab-account"
          className="profile-tab-panel"
          hidden={contentTab !== "account"}
        >
          <section className="profile-section" aria-labelledby="profile-account-title">
            <h3 id="profile-account-title" className="type-eyebrow">
              {t("profile.account")}
            </h3>
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
                        <span className="profile-row-label">
                          {t("profile.signOut")}
                        </span>
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
        </div>

        <div
          id="profile-panel-prefs"
          role="tabpanel"
          aria-labelledby="profile-tab-prefs"
          className="profile-tab-panel"
          hidden={contentTab !== "prefs"}
        >
          <section className="profile-section" aria-labelledby="profile-prefs-title">
            <h3 id="profile-prefs-title" className="type-eyebrow">
              {t("profile.settings")}
            </h3>
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
        </div>

        <div
          id="profile-panel-storage"
          role="tabpanel"
          aria-labelledby="profile-tab-storage"
          className="profile-tab-panel"
          hidden={contentTab !== "storage"}
        >
          <section className="profile-section" aria-labelledby="profile-storage-title">
            <h3 id="profile-storage-title" className="type-eyebrow">
              {t("profile.storage")}
            </h3>
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
              <div className="profile-inset-row profile-inset-static">
                <span className="profile-row-body">
                  <span className="profile-row-label">Segond 21 (S21)</span>
                </span>
                {isReady(s21Status) ? (
                  <span className="profile-ready-badge">{t("profile.ready")}</span>
                ) : (
                  <button
                    type="button"
                    className="profile-download-btn"
                    disabled={dlBusy !== null}
                    onClick={() => void downloadVersion("s21")}
                  >
                    {isDownloading(s21Status) || dlBusy === "s21"
                      ? s21Status?.status === "downloading"
                        ? `${s21Status.progressPercent}%`
                        : "…"
                      : t("profile.download")}
                  </button>
                )}
              </div>
              <div className="profile-inset-row profile-inset-static">
                <span className="profile-row-body">
                  <span className="profile-row-label">Bib la (HT98)</span>
                </span>
                {isReady(htStatus) ? (
                  <span className="profile-ready-badge">{t("profile.ready")}</span>
                ) : (
                  <button
                    type="button"
                    className="profile-download-btn"
                    disabled={dlBusy !== null}
                    onClick={() => void downloadVersion("ht98")}
                  >
                    {isDownloading(htStatus) || dlBusy === "ht98"
                      ? htStatus?.status === "downloading"
                        ? `${htStatus.progressPercent}%`
                        : "…"
                      : t("profile.download")}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <div
          id="profile-panel-history"
          role="tabpanel"
          aria-labelledby="profile-tab-history"
          className="profile-tab-panel"
          hidden={contentTab !== "history"}
        >
          <section className="profile-section" aria-labelledby="profile-marks-title">
            <div className="profile-section-head">
              <h3 id="profile-marks-title" className="type-eyebrow">
                {t("profile.marks")}
              </h3>
              {markedVerses.length ? (
                <span className="muted type-caption">{markedVerses.length}</span>
              ) : null}
            </div>
            {markedVerses.length ? (
              <div className="profile-card profile-history-card">
                <ul className="profile-history-list">
                  {markedVerses.map((mark) => (
                    <li key={mark.key}>
                      <button
                        type="button"
                        className="profile-history-item"
                        onClick={() =>
                          onOpenPassage({
                            versionId: "s21",
                            bookId: mark.bookId,
                            chapterId: mark.chapterId,
                            verse: mark.verse,
                          })
                        }
                      >
                        <span className="profile-history-label">
                          <span
                            className="profile-mark-swatch"
                            style={{ background: mark.color }}
                            aria-hidden
                          />
                          {mark.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="muted">{t("profile.marksEmpty")}</p>
            )}
          </section>

          <section className="profile-section" aria-labelledby="profile-history-title">
            <div className="profile-section-head">
              <h3 id="profile-history-title" className="type-eyebrow">
                {t("profile.history")}
              </h3>
              {history.length ? (
                <button
                  type="button"
                  className={`profile-text-btn${confirmClear ? " is-confirm-warn" : ""}`}
                  onClick={requestClearHistory}
                >
                  {confirmClear
                    ? t("profile.clearHistoryConfirm")
                    : t("profile.clearHistory")}
                </button>
              ) : null}
            </div>
            {history.length ? (
              <div className="profile-card profile-history-card">
                <ul className="profile-history-list">
                  {history.map((event) => {
                    const ref = parseRef(event);
                    if (!ref) return null;
                    const versionBadge =
                      String(event.meta?.versionBadge || "").trim() ||
                      (ref.versionId === "ht98" ? "KREYÒL" : "S21");
                    const label =
                      String(event.meta?.label || "").trim() ||
                      (ref.verse != null
                        ? `${ref.bookId} ${ref.chapterId}.${ref.verse}`
                        : `${ref.bookId} ${ref.chapterId}`);
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          className="profile-history-item"
                          onClick={() => onOpenPassage(ref)}
                        >
                          <span className="profile-history-label">
                            <span
                              className="bible-history-version-badge"
                              data-version={ref.versionId}
                            >
                              {versionBadge}
                            </span>
                            {label}
                          </span>
                          <span className="profile-history-when muted">
                            {formatActivityWhen(event.at, dateLocale)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="muted">{t("profile.historyEmpty")}</p>
            )}
          </section>
        </div>

        {showAdminEntry ? (
          <div
            id="profile-panel-admin"
            role="tabpanel"
            aria-labelledby="profile-tab-admin"
            className="profile-tab-panel profile-tab-panel--admin"
            hidden={contentTab !== "admin"}
          >
            {contentTab === "admin" ? (
              <AdminReadingPlansWorkspace
                embedded
                userEmail={user?.email ?? null}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
