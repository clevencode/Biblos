import {
  clearOfflineBible,
  isOfflineBibleReady,
} from "../bibleOffline";
import { YvIcon } from "./YvIcon";
import {
  ACTIVITY_UI_ENABLED,
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
  isClevencodeAdmin,
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
  notionHealth?: "unknown" | "ok" | "no-token" | "down";
  onSyncNow?: () => Promise<void> | void;
  onOpenVerse?: (mark: SavedVerseMark) => void;
  onOpenFlashcard?: (cardId: string) => void;
  onOpenReading?: (ref: {
    bookId: string;
    chapterId: string;
    verse?: number | null;
  }) => void;
  onReadingHistoryChange?: () => void;
};

type ProfileTabId = "config" | "library" | "help" | "about";

const PROFILE_TABS: { id: ProfileTabId; label: string }[] = [
  { id: "config", label: "Réglages" },
  { id: "library", label: "Gardé" },
  { id: "help", label: "Aide" },
  { id: "about", label: "À propos" },
];

const APP_VERSION = __APP_VERSION__;

const THEME_OPTIONS: {
  id: ThemePref;
  label: string;
  icon: string;
}[] = [
  { id: "light", label: "Clair", icon: "light_mode" },
  { id: "dark", label: "Sombre", icon: "dark_mode" },
  { id: "system", label: "Système", icon: "desktop_windows" },
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
  notionHealth = "unknown",
  onSyncNow,
  onOpenVerse,
  onOpenFlashcard,
  onOpenReading,
  onReadingHistoryChange,
}: ProfileViewProps) {
  const [tab, setTab] = useState<ProfileTabId>("config");
  /** Toujours false au montage — le panneau Profil est monté avant l’onboarding. */
  const [accountSession, setAccountSession] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineClearBusy, setOfflineClearBusy] = useState(false);
  const [fullName, setFullName] = useState(() =>
    joinFullName(profile.firstName, profile.lastName),
  );
  const [editingName, setEditingName] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [readingHistory, setReadingHistory] = useState<ActivityEvent[]>([]);
  const [adminCategory, setAdminCategory] =
    useState<AdminMessageCategoryId>("suggestion");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncFlash, setSyncFlash] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() =>
    loadNotificationPrefs(),
  );

  useEffect(() => {
    panelsRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    if (editingName) return;
    setFullName(joinFullName(profile.firstName, profile.lastName));
  }, [profile.firstName, profile.lastName, profile.id, editingName]);

  /** Après onboarding : fermer une éventuelle session Compte ouverte au montage à vide. */
  useEffect(() => {
    if (!profile.onboardedAt) return;
    const next = joinFullName(profile.firstName, profile.lastName);
    if (!next) return;
    setAccountSession(false);
    setEditingName(false);
    setFullName(next);
  }, [profile.onboardedAt, profile.id]);

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

  function openAccountSession() {
    setAccountSession(true);
    if (!joinFullName(profile.firstName, profile.lastName)) {
      startEditName();
    }
  }

  function closeAccountSession() {
    cancelEditName();
    setAccountSession(false);
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
    setAdminStatus(
      result.queued
        ? "Message enregistré — il sera envoyé dès que tu seras en ligne"
        : "Message envoyé à l’admin",
    );
  }

  function openDeleteConfirm() {
    if (deleteBusy) return;
    setDeleteError(null);
    setDeleteAck(false);
    setDeleteConfirmOpen(true);
  }

  function closeDeleteConfirm() {
    if (deleteBusy) return;
    setDeleteConfirmOpen(false);
    setDeleteAck(false);
    setDeleteError(null);
  }

  async function confirmDeleteAccount() {
    if (deleteBusy || !deleteAck) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await wipeLocalUserData();
      window.location.reload();
    } catch {
      setDeleteBusy(false);
      setDeleteError("Impossible d’effacer les données. Réessaie.");
    }
  }

  useEffect(() => {
    if (!deleteConfirmOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDeleteConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteConfirmOpen, deleteBusy]);

  async function confirmClearOfflineBible() {
    if (offlineClearBusy || !offlineReady) return;
    const ok = window.confirm(
      "Supprimer la Bible hors ligne (~6 Mo) de cet appareil ?",
    );
    if (!ok) return;
    setOfflineClearBusy(true);
    try {
      await clearOfflineBible();
      setOfflineReady(false);
    } catch {
      window.alert("Impossible de supprimer la Bible hors ligne. Réessaie.");
    } finally {
      setOfflineClearBusy(false);
    }
  }

  const display = preferredDisplayName(profile);
  const isAdminOwner = isClevencodeAdmin(profile);
  const avatarLetter = (display.trim().charAt(0) || "?").toLocaleUpperCase("fr-FR");
  const cloudOk = notionHealth === "ok";
  const syncHint = isAdminOwner
    ? cloudOk
    ? "Notion + clevencode — cet appareil prime"
    : notionHealth === "no-token"
        ? "Cloud non configuré sur ce serveur"
        : notionHealth === "down"
          ? "Sync cloud indisponible"
          : "Vérification de la sync…"
    : profile.notionUrl
      ? "Profil synchronisé entre tes appareils"
      : "Enregistré sur cet appareil";
  const ownerHint = "você é o dono do app";
  const subtitleHint = savedFlash
    ? "Nom enregistré"
    : isAdminOwner
      ? ownerHint
      : syncHint;

  async function runSyncNow() {
    if (!onSyncNow || syncBusy) return;
    setSyncBusy(true);
    setSyncFlash(null);
    try {
      await onSyncNow();
      setSyncFlash("À jour");
      window.setTimeout(() => setSyncFlash(null), 2200);
    } catch {
      setSyncFlash("Échec — réessaie");
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="profile-view">
      <header className="profile-head">
        <span className="profile-avatar" aria-hidden>
          <span className="profile-avatar-letter">{avatarLetter}</span>
        </span>
        <div className="profile-head-copy">
          <h1 className="profile-title type-title">{display}</h1>
          <p className="profile-subtitle muted">
            {subtitleHint}
          </p>
        </div>
        {!accountSession ? (
          <button
            type="button"
            className="profile-config-btn"
            onClick={openAccountSession}
            aria-label="Configurer le compte"
            title="Compte"
          >
            <YvIcon name="settings" className="profile-config-icon" />
          </button>
        ) : null}
      </header>

      {accountSession ? (
        <div className="profile-account-session">
          <button
            type="button"
            className="flash-list-back profile-account-back"
            onClick={closeAccountSession}
            aria-label="Retour au profil"
          >
            ← Compte
          </button>

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
              {isAdminOwner ? ownerHint : syncHint}
            </p>
          </ProfilePanel>

          <ProfilePanel titleId="profile-delete-label" title="Compte">
            <p className="profile-delete-warn">
              Supprimer ton compte effacera <strong>toutes tes données</strong>{" "}
              sur cet appareil : profil, progression, notes, flashcards et
              historique. Cette action est irréversible.
            </p>
            <button
              type="button"
              className="profile-delete-btn"
              disabled={deleteBusy}
              onClick={openDeleteConfirm}
            >
              <YvIcon name="delete" className="profile-delete-btn-icon" />
              Supprimer mon compte
            </button>
          </ProfilePanel>
        </div>
      ) : (
        <>
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
                  onClick={() => setTab(id)}
                >
                  <span className="profile-tab-label">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="profile-tab-panels" ref={panelsRef}>
            <div
              id="profile-panel-config"
              role="tabpanel"
              aria-labelledby="profile-tab-config"
              hidden={tab !== "config"}
              className="profile-tab-panel"
            >
          <ProfilePanel
            titleId="profile-sync-label"
            title="Synchronisation"
            hint={
              isAdminOwner
                ? "Cet appareil est la source de vérité : sync envoie au Notion ce qui manque."
                : "Ton profil et ta progression suivent ton compte."
            }
          >
            <ul className="profile-facts">
              <li>
                <span className="profile-fact-label">Cloud Notion</span>
                <span className="profile-fact-value">
                  {notionHealth === "ok"
                    ? "Connecté"
                    : notionHealth === "no-token"
                      ? "Non configuré"
                      : notionHealth === "down"
                        ? "Hors ligne"
                        : "…"}
                </span>
              </li>
              <li>
                <span className="profile-fact-label">Versets marqués</span>
                <span className="profile-fact-value">{savedVerses.length}</span>
              </li>
              <li>
                <span className="profile-fact-label">VERSECARD</span>
                <span className="profile-fact-value">{flashcards.length}</span>
              </li>
              <li>
                <span className="profile-fact-label">Appareil</span>
                <span className="profile-fact-value">
                  {isAdminOwner
                    ? "Mobile → Notion (si absent)"
                    : profile.notionUrl
                      ? "Profil lié"
                      : "Local"}
                </span>
              </li>
            </ul>
            {isAdminOwner && onSyncNow ? (
              <button
                type="button"
                className="profile-sync-btn"
                disabled={syncBusy || notionHealth === "down"}
                onClick={() => void runSyncNow()}
              >
                <YvIcon name="sync" className="profile-sync-btn-icon" />
                {syncBusy ? "Synchronisation…" : "Synchroniser maintenant"}
              </button>
            ) : null}
            {syncFlash ? (
              <p className="profile-id-hint muted" aria-live="polite">
                {syncFlash}
              </p>
            ) : (
              <p className="profile-id-hint muted">{syncHint}</p>
            )}
          </ProfilePanel>

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
              {THEME_OPTIONS.map(({ id, label, icon }) => {
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
                    <YvIcon name={icon} className="profile-theme-icon" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </ProfilePanel>

          <ProfilePanel
            titleId="profile-notif-label"
            title="Notifications"
            hint="Alertes sur ton téléphone — activées à l’acceptation des termes."
          >
            <ul className="profile-notif-toggles">
              {(
                [
                  {
                    key: "verseOfDay" as const,
                    label: "Verset du jour",
                    desc: "Notification quotidienne sur l’appareil",
                  },
                  {
                    key: "planReminder" as const,
                    label: "Rappel de plan",
                    desc: "Rappel de lecture sur l’appareil",
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
            {offlineReady ? (
              <button
                type="button"
                className="profile-offline-remove-btn"
                disabled={offlineClearBusy}
                onClick={() => void confirmClearOfflineBible()}
              >
                <YvIcon name="delete" className="profile-offline-remove-icon" />
                {offlineClearBusy
                  ? "Suppression…"
                  : "Supprimer le téléchargement"}
              </button>
            ) : (
              <p className="profile-id-hint muted">
                Télécharge la Bible depuis Lecture pour l’utiliser hors ligne.
              </p>
            )}
          </ProfilePanel>
        </div>

        <div
          id="profile-panel-library"
          role="tabpanel"
          aria-labelledby="profile-tab-library"
          hidden={tab !== "library"}
          className="profile-tab-panel"
        >
          {ACTIVITY_UI_ENABLED ? (
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
                      <YvIcon name="delete" className="profile-clear-history-icon" />
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
                            <YvIcon
                              name="delete"
                              className="profile-history-delete-icon"
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

          <ProfilePanel
            titleId="profile-cards-label"
            title="VERSECARD"
            hint="Cartes d’étude liées aux versets marqués — même sync multi-appareil."
          >
            {flashcards.length === 0 ? (
              <p className="profile-section-hint muted">
                Aucune carte — marque un verset puis crée une flashcard dans Lecture.
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

          {ACTIVITY_UI_ENABLED ? (
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
        </div>

        <div
          id="profile-panel-about"
          role="tabpanel"
          aria-labelledby="profile-tab-about"
          hidden={tab !== "about"}
          className="profile-tab-panel"
        >
          <ProfilePanel titleId="profile-app-label" title="Application">
            <ul className="profile-facts">
              <li>
                <span className="profile-fact-label">Version</span>
                <span className="profile-fact-value">{APP_VERSION}</span>
              </li>
              <li>
                <span className="profile-fact-label">Mise à jour</span>
                <span className="profile-fact-value">n° {APP_VERSION}</span>
              </li>
            </ul>
          </ProfilePanel>

          <ProfilePanel titleId="profile-about-label" title="À propos">
            <p className="profile-about">
              Biblos — lecture, plans et flashcards. L’application en phase de test
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
        </>
      )}

      {deleteConfirmOpen ? (
        <div
          className="profile-delete-overlay"
          role="presentation"
          onClick={closeDeleteConfirm}
        >
          <div
            className="profile-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-delete-dialog-head">
              <h2 id="profile-delete-title" className="profile-delete-dialog-title">
                Supprimer ton compte ?
              </h2>
              <button
                type="button"
                className="profile-delete-dialog-exit"
                onClick={closeDeleteConfirm}
                disabled={deleteBusy}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="profile-delete-dialog-body">
              <p>
                Sur <strong>cet appareil</strong>, ces données seront effacées
                définitivement :
              </p>
              <ul className="profile-delete-impact">
                <li>Profil et préférences</li>
                <li>Progression et historique</li>
                <li>Notes et versets marqués</li>
                <li>Flashcards</li>
                <li>Bible hors ligne</li>
              </ul>
              <p className="profile-delete-dialog-foot muted">
                Cette action est irréversible. Tu ne pourras pas récupérer ces
                données ensuite.
                {profile.notionUrl
                  ? " Les copies éventuellement synchronisées ailleurs ne sont pas gérées ici."
                  : null}
              </p>

              <label className="profile-delete-ack">
                <input
                  type="checkbox"
                  checked={deleteAck}
                  disabled={deleteBusy}
                  onChange={(event) => setDeleteAck(event.target.checked)}
                />
                <span>Je comprends que cette action est irréversible</span>
              </label>

              {deleteError ? (
                <p className="profile-delete-error" role="alert">
                  {deleteError}
                </p>
              ) : null}
            </div>

            <div className="profile-delete-dialog-actions">
              <button
                type="button"
                className="profile-delete-cancel"
                onClick={closeDeleteConfirm}
                disabled={deleteBusy}
              >
                Annuler
              </button>
              <button
                type="button"
                className="profile-delete-confirm"
                disabled={deleteBusy || !deleteAck}
                aria-busy={deleteBusy}
                onClick={() => void confirmDeleteAccount()}
              >
                {deleteBusy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
