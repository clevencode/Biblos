import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { YvIcon } from "./YvIcon";
import {
  clearBibleReadingHistory,
  formatActivityWhen,
  listBibleReadingHistory,
} from "../activityLog";
import {
  completeOnboarding,
  joinFullName,
  preferredDisplayName,
  splitFullName,
} from "../userProfile";
import { resolveTheme, themePrefLabel, type ThemePref } from "../theme";
import type { BibleHistorySelect } from "./BibleHistorySheet";
import {
  getStorageHealth,
  type StorageHealth,
} from "../offlineStorageGuard";
import {
  resolveVersionAvailability,
  versionAvailabilityLabel,
  type VersionAvailabilityState,
} from "../bible/bibleVersionStatus";
import {
  countMarkedVerses,
  FREE_MARK_QUOTA,
} from "../verseMarks";
import { useConsumerAuth } from "../features/consumer-auth";
import {
  downloadUserBackupJson,
  subscribeSyncStatus,
  type SyncStatus,
} from "../features/user-sync";

type ProfileShellPanelProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onCycleTheme: () => void;
  onOpenPassage: (ref: BibleHistorySelect) => void;
  onHistoryChange?: () => void;
  onRequestSignIn?: () => void;
};

function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case "synced":
      return "Synchronisé";
    case "pending":
      return "Hors ligne — modifications en attente";
    case "offline":
      return "Hors ligne — modifications en attente";
    default:
      return "Sync inactive";
  }
}

export function ProfileShellPanel({
  active,
  activityTick,
  themePref,
  onCycleTheme,
  onOpenPassage,
  onHistoryChange,
  onRequestSignIn,
}: ProfileShellPanelProps) {
  const {
    session,
    profile,
    signOut,
    deleteAccountAndData,
    refreshProfile,
    loading,
    isAuthenticated,
  } = useConsumerAuth();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [s21Status, setS21Status] = useState<VersionAvailabilityState | null>(null);
  const [htStatus, setHtStatus] = useState<VersionAvailabilityState | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState(() =>
    joinFullName(profile.firstName, profile.lastName),
  );
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const markedCount = useMemo(() => {
    void activityTick;
    return countMarkedVerses();
  }, [activityTick]);

  const history = useMemo(() => {
    void activityTick;
    return listBibleReadingHistory(profile.id, 12);
  }, [activityTick, profile.id]);

  useEffect(() => {
    setFullName(joinFullName(profile.firstName, profile.lastName));
  }, [profile.firstName, profile.lastName]);

  useEffect(() => subscribeSyncStatus(setSyncStatus), []);

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
  }, [active, activityTick]);

  function parseRef(event: (typeof history)[0]): BibleHistorySelect | null {
    const bookId = String(event.meta?.bookId || "").trim().toUpperCase();
    const chapterId = String(event.meta?.chapterId || "").trim();
    if (!bookId || !chapterId) return null;
    const verseRaw = event.meta?.verse;
    const verse =
      typeof verseRaw === "number" && Number.isFinite(verseRaw) ? verseRaw : null;
    return { bookId, chapterId, verse };
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

  async function handleDeleteAccount() {
    if (deleteBusy) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteAccountAndData();
      setConfirmDelete(false);
    } finally {
      setDeleteBusy(false);
    }
  }

  const displayName = preferredDisplayName(profile) || "…";
  const guest = session.status === "anonymous" || session.status === "offline_guest";
  const quotaHint =
    guest && markedCount >= Math.max(1, FREE_MARK_QUOTA - 3)
      ? `${markedCount}/${FREE_MARK_QUOTA} surlignages — relie un compte pour continuer sereinement`
      : null;

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
          <h2 className="type-headline">Profil</h2>
          <p className="muted type-caption">
            {isAuthenticated
              ? displayName
              : session.status === "offline_guest"
                ? "Mode hors ligne (cet appareil)"
                : "Études sur cet appareil"}
          </p>
        </div>
      </header>

      <section className="profile-section" aria-labelledby="profile-account-title">
        <h3 id="profile-account-title" className="type-eyebrow">
          Compte
        </h3>
        {guest ? (
          <div className="profile-sign-in-banner">
            <p>
              <strong>Sauvegarder mes études</strong>
              <br />
              Relie Google ou un e-mail pour synchroniser marques, notes et plans
              entre tes appareils.
            </p>
            {quotaHint ? <p className="muted">{quotaHint}</p> : null}
            <button
              type="button"
              className="auth-google-btn"
              disabled={loading}
              onClick={() => onRequestSignIn?.()}
            >
              Connecter un compte
            </button>
          </div>
        ) : (
          <>
            {editingName ? (
              <form className="profile-onboarding-form" onSubmit={saveName}>
                <label className="profile-field">
                  <span>Nom complet</span>
                  <input
                    ref={nameInputRef}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={128}
                    autoComplete="name"
                  />
                </label>
                <button type="submit" className="profile-save-btn">
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="profile-onboarding-cancel"
                  onClick={() => {
                    setFullName(joinFullName(profile.firstName, profile.lastName));
                    setEditingName(false);
                  }}
                >
                  Annuler
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="profile-row-btn"
                onClick={() => setEditingName(true)}
              >
                <YvIcon name="person" className="profile-row-icon" opsz={20} />
                <span className="profile-row-body">
                  <span className="profile-row-label">{displayName}</span>
                  <span className="profile-row-value muted">
                    {profile.email || "Compte connecté"}
                  </span>
                </span>
                <YvIcon name="chevron_right" className="profile-row-chevron" opsz={20} />
              </button>
            )}
            <div className="profile-row-btn" role="status">
              <YvIcon name="sync" className="profile-row-icon" opsz={20} />
              <span className="profile-row-body">
                <span className="profile-row-label">Synchronisation</span>
                <span className="profile-row-value muted">
                  {syncStatusLabel(syncStatus)}
                </span>
              </span>
            </div>
            <button
              type="button"
              className="profile-row-btn"
              disabled={signOutBusy}
              onClick={() => void handleSignOut()}
            >
              <YvIcon name="close" className="profile-row-icon" opsz={20} />
              <span className="profile-row-body">
                <span className="profile-row-label">Se déconnecter</span>
                <span className="profile-row-value muted">
                  Les Bibles téléchargées restent sur l’appareil
                </span>
              </span>
            </button>
            <button
              type="button"
              className="profile-row-btn"
              disabled={deleteBusy}
              onClick={() => void handleDeleteAccount()}
            >
              <YvIcon name="delete" className="profile-row-icon" opsz={20} />
              <span className="profile-row-body">
                <span className="profile-row-label">
                  {confirmDelete ? "Confirmer la suppression" : "Supprimer mon compte"}
                </span>
                <span className="profile-row-value muted">
                  Efface tes données cloud (pas les textes bibliques)
                </span>
              </span>
            </button>
          </>
        )}
        <button
          type="button"
          className="profile-row-btn"
          onClick={() =>
            downloadUserBackupJson(
              `biblos-backup-${new Date().toISOString().slice(0, 10)}.json`,
            )
          }
        >
          <YvIcon name="download" className="profile-row-icon" opsz={20} />
          <span className="profile-row-body">
            <span className="profile-row-label">Exporter backup (JSON)</span>
            <span className="profile-row-value muted">
              Marques, notes et progrès de plans
            </span>
          </span>
        </button>
      </section>

      <section className="profile-section" aria-labelledby="profile-editorial-title">
        <h3 id="profile-editorial-title" className="type-eyebrow">
          Édition
        </h3>
        <a className="profile-row-btn" href="#admin">
          <span className="profile-row-body">
            <span className="profile-row-label">CMS plans (Firestore)</span>
            <span className="profile-row-value muted">Connexion éditeur</span>
          </span>
        </a>
      </section>

      <section className="profile-section" aria-labelledby="profile-prefs-title">
        <h3 id="profile-prefs-title" className="type-eyebrow">
          Préférences
        </h3>
        <button type="button" className="profile-row-btn" onClick={onCycleTheme}>
          <YvIcon
            name={resolveTheme(themePref) === "light" ? "light_mode" : "dark_mode"}
            className="profile-row-icon"
            opsz={20}
          />
          <span className="profile-row-body">
            <span className="profile-row-label">Apparence</span>
            <span className="profile-row-value muted">{themePrefLabel(themePref)}</span>
          </span>
          <YvIcon name="chevron_right" className="profile-row-chevron" opsz={20} />
        </button>
      </section>

      <section className="profile-section" aria-labelledby="profile-storage-title">
        <h3 id="profile-storage-title" className="type-eyebrow">
          Stockage
        </h3>
        <div className="profile-row-btn" role="group" aria-label="Espace hors ligne">
          <YvIcon name="download" className="profile-row-icon" opsz={20} />
          <span className="profile-row-body">
            <span className="profile-row-label">Cache hors ligne</span>
            <span className="profile-row-value muted">
              {storageHealth
                ? `${storageHealth.usedMB} Mo utilisés${
                    storageHealth.quotaMB > 0 ? ` / ${storageHealth.quotaMB} Mo` : ""
                  }`
                : "Calcul…"}
            </span>
            <span className="profile-row-value muted">
              {storageHealth?.isPersisted
                ? "Stockage protégé (persistant)"
                : "Protection non garantie par le système"}
            </span>
          </span>
        </div>
        <div className="profile-row-btn" role="group" aria-label="Versions hors ligne">
          <YvIcon name="menu_book" className="profile-row-icon" opsz={20} />
          <span className="profile-row-body">
            <span className="profile-row-label">S21</span>
            <span className="profile-row-value muted">
              {s21Status ? versionAvailabilityLabel(s21Status) : "…"}
            </span>
            <span className="profile-row-label">HAT98</span>
            <span className="profile-row-value muted">
              {htStatus ? versionAvailabilityLabel(htStatus) : "…"}
            </span>
          </span>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-history-title">
        <div className="profile-section-head">
          <h3 id="profile-history-title" className="type-eyebrow">
            Historique
          </h3>
          {history.length ? (
            <button
              type="button"
              className="profile-text-btn"
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true);
                  return;
                }
                clearBibleReadingHistory(profile.id);
                setConfirmClear(false);
                onHistoryChange?.();
              }}
            >
              {confirmClear ? "Confirmer" : "Effacer"}
            </button>
          ) : null}
        </div>
        {history.length ? (
          <ul className="profile-history-list">
            {history.map((event) => {
              const ref = parseRef(event);
              if (!ref) return null;
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
                    <span className="profile-history-label">{label}</span>
                    <span className="profile-history-when muted">
                      {formatActivityWhen(event.at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">Aucune lecture enregistrée pour le moment.</p>
        )}
      </section>
    </div>
  );
}
