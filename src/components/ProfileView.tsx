import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  isOfflineBibleReady,
} from "../bibleOffline";
import {
  activityTypeLabel,
  clearBibleReadingHistory,
  formatActivityWhen,
  listActivityForUser,
  listBibleReadingHistory,
  removeActivityById,
  type ActivityEvent,
} from "../activityLog";
import {
  preferredDisplayName,
  type UserProfile,
} from "../userProfile";
import {
  themePrefLabel,
  type ThemePref,
} from "../theme";
import { sendAdminMessage } from "../adminMessage";
import type { Flashcard } from "../types";
import type { SavedVerseMark } from "../verseMarks";
import { useEffect, useState, type FormEvent } from "react";

type ProfileViewProps = {
  profile: UserProfile;
  themePref: ThemePref;
  onThemePrefChange: (pref: ThemePref) => void;
  onProfileSave: (input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) => void;
  activityTick?: number;
  savedVerses?: SavedVerseMark[];
  flashcards?: Flashcard[];
  onOpenVerse?: (mark: SavedVerseMark) => void;
  onOpenFlashcard?: (cardId: string) => void;
  onOpenReading?: (ref: {
    bookId: string;
    chapterId: string;
    verse?: number | null;
  }) => void;
  onReadingHistoryChange?: () => void;
};

const THEME_OPTIONS: {
  id: ThemePref;
  label: string;
  Icon: typeof SunIcon;
}[] = [
  { id: "light", label: "Clair", Icon: SunIcon },
  { id: "dark", label: "Sombre", Icon: MoonIcon },
  { id: "system", label: "Système", Icon: ComputerDesktopIcon },
];

export function ProfileView({
  profile,
  themePref,
  onThemePrefChange,
  onProfileSave,
  activityTick = 0,
  savedVerses = [],
  flashcards = [],
  onOpenVerse,
  onOpenFlashcard,
  onOpenReading,
  onReadingHistoryChange,
}: ProfileViewProps) {
  const [offlineReady, setOfflineReady] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [preferredName, setPreferredName] = useState(profile.preferredName);
  const [savedFlash, setSavedFlash] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [readingHistory, setReadingHistory] = useState<ActivityEvent[]>([]);
  const [adminTitle, setAdminTitle] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setPreferredName(profile.preferredName);
  }, [profile.firstName, profile.lastName, profile.preferredName, profile.id]);

  useEffect(() => {
    let cancelled = false;
    void isOfflineBibleReady().then((ready) => {
      if (!cancelled) setOfflineReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActivities(listActivityForUser(profile.id, 12));
    setReadingHistory(listBibleReadingHistory(profile.id, 24));
  }, [profile.id, activityTick]);

  function submitName(event: FormEvent) {
    event.preventDefault();
    const first = firstName.trim();
    if (!first) return;
    onProfileSave({
      firstName: first,
      lastName: lastName.trim(),
      preferredName: preferredName.trim() || first,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  async function submitAdminMessage(event: FormEvent) {
    event.preventDefault();
    if (adminBusy) return;
    const title = adminTitle.trim();
    const body = adminMessage.trim();
    if (!title) {
      setAdminStatus("Titre requis");
      return;
    }
    if (!body) {
      setAdminStatus("Message vide");
      return;
    }
    setAdminBusy(true);
    setAdminStatus(null);
    const result = await sendAdminMessage(profile, { title, body });
    setAdminBusy(false);
    if (!result.ok) {
      setAdminStatus(result.error || "Envoi échoué");
      return;
    }
    setAdminTitle("");
    setAdminMessage("");
    setAdminStatus("Message envoyé à l’admin");
  }

  const display = preferredDisplayName(profile);
  const avatarLetter = (display.trim().charAt(0) || "?").toLocaleUpperCase("fr-FR");

  return (
    <div className="profile-view">
      <header className="profile-head">
        <span className="profile-avatar" aria-hidden>
          <span className="profile-avatar-letter">{avatarLetter}</span>
        </span>
        <div className="profile-head-copy">
          <h1 className="profile-title type-title">{display}</h1>
          <p className="profile-subtitle muted">Profil · préférences</p>
        </div>
      </header>

      <section className="profile-section" aria-labelledby="profile-name-label">
        <h2 id="profile-name-label" className="profile-section-title">
          Identité
        </h2>
        <form className="profile-name-form" onSubmit={submitName}>
          <label className="profile-field">
            <span>Prénom</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
              maxLength={64}
            />
          </label>
          <label className="profile-field">
            <span>Nom</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              maxLength={64}
            />
          </label>
          <label className="profile-field">
            <span>Nom préféré</span>
            <input
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              autoComplete="nickname"
              placeholder={firstName.trim() || "Nom affiché"}
              maxLength={64}
            />
          </label>
          <div className="profile-name-actions">
            <button type="submit" className="profile-save-btn">
              Enregistrer
            </button>
            {savedFlash ? (
              <span className="profile-saved muted" aria-live="polite">
                Enregistré
              </span>
            ) : null}
          </div>
        </form>
        <p className="profile-id-hint muted">
          ID privé · {profile.id.slice(0, 8)}…
          {profile.notionUrl ? " · sync Notion" : ""}
        </p>
      </section>

      <section className="profile-section" aria-labelledby="profile-reading-label">
        <h2 id="profile-reading-label" className="profile-section-title">
          Historique de lecture
        </h2>
        {readingHistory.length === 0 ? (
          <p className="profile-section-hint muted">
            Aucune lecture enregistrée — ouvre un chapitre dans Lecture.
          </p>
        ) : (
          <>
            <div className="profile-section-actions">
              <button
                type="button"
                className="profile-clear-history-btn"
                onClick={() => {
                  const ok = window.confirm(
                    "Effacer tout l’historique de lecture ?",
                  );
                  if (!ok) return;
                  clearBibleReadingHistory(profile.id);
                  setReadingHistory([]);
                  onReadingHistoryChange?.();
                }}
              >
                <TrashIcon className="profile-clear-history-icon" aria-hidden />
                Effacer l’historique
              </button>
            </div>
            <ul className="profile-library-list">
              {readingHistory.map((event) => {
                const bookId = String(event.meta?.bookId || "").trim();
                const chapterId = String(event.meta?.chapterId || "").trim();
                const verseRaw = event.meta?.verse;
                const verse =
                  typeof verseRaw === "number" && Number.isFinite(verseRaw)
                    ? verseRaw
                    : null;
                const label =
                  String(event.meta?.label || "").trim() ||
                  (bookId && chapterId
                    ? verse
                      ? `${bookId} ${chapterId}.${verse}`
                      : `${bookId} ${chapterId}`
                    : "Passage");
                return (
                  <li key={event.id} className="profile-history-row">
                    <button
                      type="button"
                      className="profile-library-item"
                      onClick={() => {
                        if (!bookId || !chapterId) return;
                        onOpenReading?.({ bookId, chapterId, verse });
                      }}
                    >
                      <span className="profile-library-copy">
                        <span className="profile-library-label">{label}</span>
                        <span className="profile-library-meta muted">
                          {formatActivityWhen(event.at)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="profile-history-delete"
                      aria-label={`Supprimer ${label}`}
                      onClick={() => {
                        if (!removeActivityById(event.id, profile.id)) return;
                        setReadingHistory((list) =>
                          list.filter((item) => item.id !== event.id),
                        );
                        onReadingHistoryChange?.();
                      }}
                    >
                      <TrashIcon
                        className="profile-history-delete-icon"
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="profile-section" aria-labelledby="profile-verses-label">
        <h2 id="profile-verses-label" className="profile-section-title">
          Versets marqués
        </h2>
        {savedVerses.length === 0 ? (
          <p className="profile-section-hint muted">
            Aucun verset marqué — utilise Marquer dans Lecture.
          </p>
        ) : (
          <ul className="profile-library-list">
            {savedVerses.slice(0, 40).map((mark) => (
              <li key={mark.key}>
                <button
                  type="button"
                  className="profile-library-item"
                  onClick={() => onOpenVerse?.(mark)}
                >
                  <span
                    className="profile-library-swatch"
                    style={{ background: mark.color }}
                    aria-hidden
                  />
                  <span className="profile-library-label">{mark.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {savedVerses.length > 40 ? (
          <p className="profile-section-hint muted">+{savedVerses.length - 40} autres</p>
        ) : null}
      </section>

      <section className="profile-section" aria-labelledby="profile-cards-label">
        <h2 id="profile-cards-label" className="profile-section-title">
          Flashcards
        </h2>
        {flashcards.length === 0 ? (
          <p className="profile-section-hint muted">
            Aucune flashcard — crée-en depuis un verset.
          </p>
        ) : (
          <ul className="profile-library-list">
            {flashcards.slice(0, 40).map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  className="profile-library-item"
                  onClick={() => onOpenFlashcard?.(card.id)}
                >
                  {card.color ? (
                    <span
                      className="profile-library-swatch"
                      style={{ background: card.color }}
                      aria-hidden
                    />
                  ) : (
                    <span className="profile-library-swatch is-empty" aria-hidden />
                  )}
                  <span className="profile-library-copy">
                    <span className="profile-library-label">{card.frente}</span>
                    {card.lembrete ? (
                      <span className="profile-library-meta muted">
                        Rappel · {card.lembrete}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {flashcards.length > 40 ? (
          <p className="profile-section-hint muted">+{flashcards.length - 40} autres</p>
        ) : null}
      </section>

      <section className="profile-section" aria-labelledby="profile-theme-label">
        <h2 id="profile-theme-label" className="profile-section-title">
          Apparence
        </h2>
        <p className="profile-section-hint muted">{themePrefLabel(themePref)}</p>
        <div className="profile-theme-row" role="radiogroup" aria-labelledby="profile-theme-label">
          {THEME_OPTIONS.map(({ id, label, Icon }) => {
            const on = themePref === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                className={`profile-theme-btn${on ? " is-on" : ""}`}
                aria-checked={on}
                onClick={() => onThemePrefChange(id)}
              >
                <Icon className="profile-theme-icon" aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-admin-label">
        <h2 id="profile-admin-label" className="profile-section-title">
          Contacter l’admin
        </h2>
        <p className="profile-section-hint muted">
          Envoie une note à l’équipe — stockée dans Notion pour suivi / IA.
        </p>
        <form className="profile-admin-form" onSubmit={(e) => void submitAdminMessage(e)}>
          <label className="profile-field">
            <span>Titre</span>
            <input
              value={adminTitle}
              onChange={(e) => setAdminTitle(e.target.value)}
              maxLength={120}
              placeholder="Sujet du message"
              required
            />
          </label>
          <label className="profile-field">
            <span>Message</span>
            <textarea
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Suggestion, bug, question…"
              required
            />
          </label>
          <div className="profile-name-actions">
            <button
              type="submit"
              className="profile-save-btn"
              disabled={adminBusy || !adminTitle.trim() || !adminMessage.trim()}
            >
              {adminBusy ? "Envoi…" : "Envoyer"}
            </button>
            {adminStatus ? (
              <span className="profile-saved muted" aria-live="polite">
                {adminStatus}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="profile-activity-label">
        <h2 id="profile-activity-label" className="profile-section-title">
          Activité récente
        </h2>
        {activities.length === 0 ? (
          <p className="profile-section-hint muted">Aucune activité pour l’instant.</p>
        ) : (
          <ul className="profile-activity-list">
            {activities.map((event) => {
              const detail =
                event.type === "bible.read"
                  ? String(event.meta?.label || "").trim()
                  : "";
              return (
                <li key={event.id}>
                  <span className="profile-activity-type">
                    {activityTypeLabel(event.type)}
                    {detail ? ` · ${detail}` : ""}
                  </span>
                  <span className="profile-activity-when muted">
                    {formatActivityWhen(event.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="profile-section" aria-labelledby="profile-bible-label">
        <h2 id="profile-bible-label" className="profile-section-title">
          Bible
        </h2>
        <ul className="profile-facts">
          <li>
            <span className="profile-fact-label">Traduction</span>
            <span className="profile-fact-value">Segond 21</span>
          </li>
          <li>
            <span className="profile-fact-label">Hors ligne</span>
            <span className="profile-fact-value">
              {offlineReady ? "Disponible" : "Non téléchargée"}
            </span>
          </li>
        </ul>
      </section>

      <section className="profile-section" aria-labelledby="profile-about-label">
        <h2 id="profile-about-label" className="profile-section-title">
          À propos
        </h2>
        <p className="profile-about">
          Biblos — lecture, plans et flashcards. Application web progressive.
        </p>
      </section>
    </div>
  );
}
