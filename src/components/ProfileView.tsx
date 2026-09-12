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
  ACTIVITY_TRACKING_ENABLED,
  activityTypeLabel,
  clearBibleReadingHistory,
  formatActivityWhen,
  listActivityForUser,
  listBibleReadingHistory,
  removeActivityById,
  type ActivityEvent,
} from "../activityLog";
import {
  joinFullName,
  preferredDisplayName,
  splitFullName,
  wipeLocalUserData,
  type UserProfile,
} from "../userProfile";
import {
  loadNotificationPrefs,
  patchNotificationPrefs,
  type NotificationPrefs,
} from "../notificationPrefs";
import {
  themePrefLabel,
  type ThemePref,
} from "../theme";
import { sendAdminMessage, ADMIN_MESSAGE_CATEGORIES, type AdminMessageCategoryId } from "../adminMessage";
import type { Flashcard } from "../types";
import type { SavedVerseMark } from "../verseMarks";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PrivacyPolicyPanels } from "./PrivacyLegal";

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

type ProfileTabId = "compte" | "config" | "library" | "help";

const PROFILE_TABS: { id: ProfileTabId; label: string }[] = [
  { id: "compte", label: "Compte" },
  { id: "config", label: "Réglages" },
  { id: "library", label: "Biblio" },
  { id: "help", label: "Aide" },
];

const THEME_OPTIONS: {
  id: ThemePref;
  label: string;
  Icon: typeof SunIcon;
}[] = [
  { id: "light", label: "Clair", Icon: SunIcon },
  { id: "dark", label: "Sombre", Icon: MoonIcon },
  { id: "system", label: "Système", Icon: ComputerDesktopIcon },
];

function ProfilePanel({
  titleId,
  title,
  hint,
  children,
}: {
  titleId: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="profile-panel" aria-labelledby={titleId}>
      <h3 id={titleId} className="profile-panel-title">
        {title}
      </h3>
      {hint ? <p className="profile-section-hint muted">{hint}</p> : null}
      {children}
    </section>
  );
}

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
  const [tab, setTab] = useState<ProfileTabId>("compte");
  const [offlineReady, setOfflineReady] = useState(false);
  const [fullName, setFullName] = useState(() =>
    joinFullName(profile.firstName, profile.lastName),
  );
  const [editingName, setEditingName] = useState(
    () => !joinFullName(profile.firstName, profile.lastName),
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [readingHistory, setReadingHistory] = useState<ActivityEvent[]>([]);
  const [adminCategory, setAdminCategory] =
    useState<AdminMessageCategoryId>("suggestion");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() =>
    loadNotificationPrefs(),
  );

  useEffect(() => {
    if (editingName) return;
    setFullName(joinFullName(profile.firstName, profile.lastName));
  }, [profile.firstName, profile.lastName, profile.id, editingName]);

  function startEditName() {
    setEditingName(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const input = nameInputRef.current;
        if (!input) return;
        input.focus({ preventScroll: true });
        const len = input.value.length;
        try {
          input.setSelectionRange(0, len);
        } catch {
          input.select();
        }
      });
    });
  }

  function cancelEditName() {
    setFullName(joinFullName(profile.firstName, profile.lastName));
    setEditingName(false);
  }

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
    if (!editingName) return;
    const trimmed = fullName.trim().replace(/\s+/g, " ");
    const { firstName, lastName } = splitFullName(trimmed);
    if (!firstName) return;
    const nextFull = joinFullName(firstName, lastName);
    if (nextFull === joinFullName(profile.firstName, profile.lastName)) {
      setFullName(nextFull);
      setEditingName(false);
      return;
    }
    onProfileSave({
      firstName,
      lastName,
      preferredName: nextFull,
    });
    setFullName(nextFull);
    setEditingName(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  const savedFullName = joinFullName(profile.firstName, profile.lastName);
  const hasSavedName = Boolean(savedFullName);
  const nameLocked = hasSavedName && !editingName;
  const nameCanSave =
    Boolean(fullName.trim()) &&
    fullName.trim().replace(/\s+/g, " ") !== savedFullName;

  async function submitAdminMessage(event: FormEvent) {
    event.preventDefault();
    if (adminBusy) return;
    const body = adminMessage.trim();
    if (!adminCategory) {
      setAdminStatus("Catégorie requise");
      return;
    }
    if (!body) {
      setAdminStatus("Message vide");
      return;
    }
    setAdminBusy(true);
    setAdminStatus(null);
    const result = await sendAdminMessage(profile, {
      category: adminCategory,
      body,
    });
    setAdminBusy(false);
    if (!result.ok) {
      setAdminStatus(result.error || "Envoi échoué");
      return;
    }
    setAdminCategory("suggestion");
    setAdminMessage("");
    setAdminStatus("Message envoyé à l’admin");
  }

  async function confirmDeleteAccount() {
    if (deleteBusy) return;
    const ok = window.confirm(
      "Attention : supprimer ton compte effacera définitivement toutes tes données sur cet appareil (profil, progression, notes, flashcards, historique, préférences…). Cette action est irréversible.\n\nContinuer ?",
    );
    if (!ok) return;
    setDeleteBusy(true);
    try {
      await wipeLocalUserData();
      window.location.reload();
    } catch {
      setDeleteBusy(false);
      window.alert("Impossible d’effacer les données. Réessaie.");
    }
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

      <div
        className="profile-tabs"
        role="tablist"
        aria-label="Sections du profil"
      >
        {PROFILE_TABS.map(({ id, label }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`profile-tab-${id}`}
              className={`profile-tab${on ? " is-on" : ""}`}
              aria-selected={on}
              aria-controls={`profile-panel-${id}`}
              tabIndex={on ? 0 : -1}
              onClick={(event) => {
                setTab(id);
                event.currentTarget.scrollIntoView({
                  behavior: "smooth",
                  inline: "center",
                  block: "nearest",
                });
              }}
            >
              <span className="profile-tab-label">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="profile-tab-panels">
        <div
          id="profile-panel-compte"
          role="tabpanel"
          aria-labelledby="profile-tab-compte"
          hidden={tab !== "compte"}
          className="profile-tab-panel"
        >
          <ProfilePanel titleId="profile-name-label" title="Identité">
            <form
              className={`profile-name-form${editingName ? " is-editing" : ""}${nameLocked ? " is-locked" : ""}`}
              onSubmit={submitName}
            >
              <label className="profile-field">
                <span>Nom complet</span>
                <input
                  ref={nameInputRef}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onClick={() => {
                    if (nameLocked) startEditName();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && editingName && hasSavedName) {
                      event.preventDefault();
                      cancelEditName();
                    }
                  }}
                  autoComplete="name"
                  enterKeyHint="done"
                  spellCheck={false}
                  required
                  maxLength={128}
                  placeholder="Ex. Alex Dupont"
                  readOnly={nameLocked}
                  aria-readonly={nameLocked}
                  className={
                    nameLocked ? "is-locked" : editingName ? "is-editing" : undefined
                  }
                />
              </label>
              <div className="profile-name-actions">
                {nameLocked ? (
                  <button
                    type="button"
                    className="profile-save-btn is-secondary"
                    onClick={startEditName}
                  >
                    Modifier
                  </button>
                ) : (
                  <>
                    {hasSavedName ? (
                      <button
                        type="button"
                        className="profile-save-btn is-ghost"
                        onClick={cancelEditName}
                      >
                        Annuler
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="profile-save-btn"
                      disabled={!nameCanSave && hasSavedName}
                    >
                      Enregistrer
                    </button>
                  </>
                )}
                {savedFlash ? (
                  <span className="profile-saved muted" aria-live="polite">
                    Enregistré
                  </span>
                ) : null}
              </div>
            </form>
            <p className="profile-id-hint muted">
              {profile.notionUrl
                ? "Profil synchronisé entre tes appareils"
                : "Profil enregistré sur cet appareil"}
            </p>
          </ProfilePanel>

          <ProfilePanel titleId="profile-delete-label" title="Suppression">
            <p className="profile-delete-warn">
              Supprimer ton compte effacera <strong>toutes tes données</strong>{" "}
              sur cet appareil : profil, progression, notes, flashcards et
              historique. Cette action est irréversible.
            </p>
            <button
              type="button"
              className="profile-delete-btn"
              disabled={deleteBusy}
              onClick={() => void confirmDeleteAccount()}
            >
              <TrashIcon className="profile-delete-btn-icon" aria-hidden />
              {deleteBusy ? "Suppression…" : "Supprimer mon compte"}
            </button>
          </ProfilePanel>
        </div>

        <div
          id="profile-panel-config"
          role="tabpanel"
          aria-labelledby="profile-tab-config"
          hidden={tab !== "config"}
          className="profile-tab-panel"
        >
          <ProfilePanel
            titleId="profile-theme-label"
            title="Apparence"
            hint={themePrefLabel(themePref)}
          >
            <div
              className="profile-theme-row"
              role="radiogroup"
              aria-labelledby="profile-theme-label"
            >
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
          </ProfilePanel>

          <ProfilePanel
            titleId="profile-notif-label"
            title="Notifications"
            hint="Types d’infos dans le fil Accueil — activés à l’acceptation des termes."
          >
            <ul className="profile-notif-toggles">
              {(
                [
                  {
                    key: "verseOfDay" as const,
                    label: "Verset du jour",
                    desc: "Rappel du verset quotidien",
                  },
                  {
                    key: "planReminder" as const,
                    label: "Rappel de plan",
                    desc: "Progression et lecture du jour",
                  },
                  {
                    key: "appInfo" as const,
                    label: "Informations de l’app",
                    desc: "Nouveautés et messages Biblos",
                  },
                ] as const
              ).map(({ key, label, desc }) => {
                const on = notifPrefs[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={`profile-notif-toggle${on ? " is-on" : ""}`}
                      role="switch"
                      aria-checked={on}
                      onClick={() => {
                        const next = patchNotificationPrefs({ [key]: !on });
                        setNotifPrefs(next);
                      }}
                    >
                      <span className="profile-notif-toggle-copy">
                        <span className="profile-notif-toggle-label">{label}</span>
                        <span className="profile-notif-toggle-desc muted">{desc}</span>
                      </span>
                      <span className="profile-notif-switch" aria-hidden>
                        <span className="profile-notif-switch-knob" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ProfilePanel>

          <ProfilePanel titleId="profile-bible-label" title="Bible">
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
          </ProfilePanel>
        </div>

        <div
          id="profile-panel-library"
          role="tabpanel"
          aria-labelledby="profile-tab-library"
          hidden={tab !== "library"}
          className="profile-tab-panel"
        >
          {ACTIVITY_TRACKING_ENABLED ? (
            <ProfilePanel titleId="profile-reading-label" title="Historique de lecture">
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
            </ProfilePanel>
          ) : null}

          <ProfilePanel titleId="profile-verses-label" title="Versets marqués">
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
          </ProfilePanel>

          <ProfilePanel titleId="profile-cards-label" title="Flashcards">
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
          </ProfilePanel>
        </div>

        <div
          id="profile-panel-help"
          role="tabpanel"
          aria-labelledby="profile-tab-help"
          hidden={tab !== "help"}
          className="profile-tab-panel"
        >
          <ProfilePanel
            titleId="profile-admin-label"
            title="Contacter l’admin"
            hint="Envoie une note à l’équipe — elle sera lue et suivie."
          >
            <form
              className="profile-admin-form"
              onSubmit={(e) => void submitAdminMessage(e)}
            >
              <div
                className="profile-admin-categories"
                role="radiogroup"
                aria-label="Type de message"
              >
                <span className="profile-admin-categories-label">Type</span>
                <div className="profile-admin-category-row">
                  {ADMIN_MESSAGE_CATEGORIES.map(({ id, label }) => {
                    const on = adminCategory === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        className={`profile-admin-category-btn${on ? " is-on" : ""}`}
                        aria-checked={on}
                        onClick={() => setAdminCategory(id)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="profile-field">
                <span>Message</span>
                <textarea
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Décris ton bug, ta suggestion ou ta question…"
                  required
                />
              </label>
              <div className="profile-name-actions">
                <button
                  type="submit"
                  className="profile-save-btn"
                  disabled={adminBusy || !adminCategory || !adminMessage.trim()}
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
          </ProfilePanel>

          {ACTIVITY_TRACKING_ENABLED ? (
            <ProfilePanel titleId="profile-activity-label" title="Activité récente">
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
            </ProfilePanel>
          ) : null}

          <ProfilePanel titleId="profile-about-label" title="À propos">
            <p className="profile-about">
              Biblos — lecture, plans et flashcards. Prototype en phase de test
              (application web progressive).
            </p>
          </ProfilePanel>

          <ProfilePanel
            titleId="profile-legal-label"
            title="Confidentialité"
            hint="Prototype — données non partagées avec des tiers"
          >
            <PrivacyPolicyPanels />
          </ProfilePanel>
        </div>
      </div>
    </div>
  );
}
