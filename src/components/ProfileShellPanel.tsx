import { useMemo, useState } from "react";
import { YvIcon } from "./YvIcon";
import {
  clearBibleReadingHistory,
  formatActivityWhen,
  listBibleReadingHistory,
} from "../activityLog";
import { loadOrCreateProfile } from "../userProfile";
import { themePrefLabel, type ThemePref } from "../theme";
import type { BibleHistorySelect } from "./BibleHistorySheet";

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

  const history = useMemo(() => {
    void activityTick;
    return listBibleReadingHistory(profile.id, 12);
  }, [activityTick, profile.id]);

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
          <YvIcon name="routine" className="profile-row-icon" opsz={20} />
          <span className="profile-row-body">
            <span className="profile-row-label">Apparence</span>
            <span className="profile-row-value muted">{themePrefLabel(themePref)}</span>
          </span>
          <YvIcon name="chevron_right" className="profile-row-chevron" opsz={20} />
        </button>
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
