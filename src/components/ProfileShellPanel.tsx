import { useEffect, useMemo, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  clearBibleReadingHistory,
  formatActivityWhen,
  listBibleReadingHistory,
} from "../activityLog";
import { loadOrCreateProfile } from "../userProfile";
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

type ProfileShellPanelProps = {
  active: boolean;
  activityTick: number;
  themePref: ThemePref;
  onCycleTheme: () => void;
  onOpenPassage: (ref: BibleHistorySelect) => void;
  onHistoryChange?: () => void;
};

export function ProfileShellPanel({
  active,
  activityTick,
  themePref,
  onCycleTheme,
  onOpenPassage,
  onHistoryChange,
}: ProfileShellPanelProps) {
  const profile = loadOrCreateProfile();
  const [confirmClear, setConfirmClear] = useState(false);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [s21Status, setS21Status] = useState<VersionAvailabilityState | null>(null);
  const [htStatus, setHtStatus] = useState<VersionAvailabilityState | null>(null);

  const history = useMemo(() => {
    void activityTick;
    return listBibleReadingHistory(profile.id, 12);
  }, [activityTick, profile.id]);

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
          <p className="muted type-caption">Données sur cet appareil</p>
        </div>
      </header>

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
