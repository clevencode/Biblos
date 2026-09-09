import { formatDay } from "../calendar";
import { loadOverride } from "../flashcardSync";
import {
  FACIL_GRADUATION,
  RETENTION_DAYS,
  RETENTION_LABELS,
  lastReviewedOn,
  nextLembrete,
  resolveFacilStreak,
} from "../retention";
import type { FlashcardSession } from "../flashcardSession";
import type { Flashcard, RetentionMark } from "../types";

type FlashcardReviewProps = {
  session: FlashcardSession;
  emptyMessage: string;
  /** Affiche la méta de répétition (dernière révision) — typique Inbox. */
  showRepetitionMeta?: boolean;
  /** Retour à la liste (écran séparé ; garde la session). */
  onBackToList?: () => void;
  /** Affiche le hint Terminé sur Facile (Inbox / graduation SRS). */
  allowGraduation?: boolean;
  /**
   * Numérotation explicite (ex. : position dans En retard).
   * Sinon, index de la session.
   */
  numbering?: {
    position: number;
    total: number;
    section?: string;
  };
};

const MARK_KEYS: Record<RetentionMark, string> = {
  dificil: "1",
  medio: "2",
  facil: "3",
};

function CardRepetitionMeta({ item }: { item: Flashcard }) {
  const last = lastReviewedOn(item);
  if (!last) return null;
  return (
    <span className="flash-card-meta">
      <time dateTime={last}>Dernière révision · {formatDay(last)}</time>
    </span>
  );
}

function markHint(
  level: RetentionMark,
  card: Flashcard | null,
  allowGraduation: boolean,
): { interval: string; when: string } {
  if (allowGraduation && level === "facil" && card) {
    const streak = resolveFacilStreak(card, loadOverride(card.id)?.facilStreak);
    if (streak + 1 >= FACIL_GRADUATION) {
      return { interval: "Terminé", when: "hors des rappels" };
    }
  }
  const days = RETENTION_DAYS[level];
  return { interval: `+${days}j`, when: formatDay(nextLembrete(level)) };
}

export function FlashcardReview({
  session,
  emptyMessage,
  showRepetitionMeta = false,
  onBackToList,
  allowGraduation = true,
  numbering,
}: FlashcardReviewProps) {
  const {
    queue,
    total,
    dueCount,
    index,
    card,
    flipped,
    flippedId,
    mark,
    sync,
    syncError,
    canNav,
    canGoPrev,
    canGoNext,
    dragX,
    dragging,
    go,
    toggleFlip,
    setMark,
    restartLearning,
    onSlidePointerDown,
    onSlidePointerMove,
    finishSlidePointer,
  } = session;

  if (!card) {
    return (
      <div className="flash flash--solo">
        <p className="muted flash-empty">{emptyMessage}</p>
        {onBackToList ? (
          <button type="button" className="flash-list-back flash-review-back" onClick={onBackToList}>
            ← Retour
          </button>
        ) : null}
      </div>
    );
  }

  const displayTotal = numbering?.total ?? total;
  const displayPos = numbering?.position ?? index + 1;
  const done = Math.max(displayPos - 1, 0);
  const after = Math.max(displayTotal - displayPos, 0);
  const progressPct = displayTotal > 0 ? (done / displayTotal) * 100 : 0;
  const grading = flipped && sync !== "saving" && card.status !== "encerrado";
  const closed = card.status === "encerrado";
  const positionLabel = numbering?.section
    ? `${numbering.section}: carte ${displayPos} sur ${displayTotal}`
    : `Carte ${displayPos} sur ${displayTotal}`;
  const hintLabel =
    after === 0
      ? numbering?.section
        ? "Dernière de cette section"
        : "Dernière carte"
      : after === 1
        ? "1 à suivre"
        : `${after} à suivre`;

  return (
    <div className={`flash flash--solo${flipped ? " is-revealed" : ""}${closed ? " is-closed" : ""}`}>
      <div className="flash-main">
        <div className="flash-head" aria-live="polite">
          <p className="session-kicker flash-session-kicker">Révision</p>
          <div className="flash-session-meter">
            <div
              className="flash-progress"
              role="progressbar"
              aria-label="Progression de la session"
              aria-valuemin={0}
              aria-valuemax={displayTotal}
              aria-valuenow={done}
              aria-valuetext={`${done} terminée${done === 1 ? "" : "s"} sur ${displayTotal}`}
            >
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flash-session-meta">
              {numbering?.section ? (
                <span className="flash-session-context">{numbering.section}</span>
              ) : null}
              <p className="flash-session-pos" aria-label={positionLabel}>
                <span className="flash-session-current">{displayPos}</span>
                <span className="flash-session-of">sur</span>
                <span className="flash-session-total">{displayTotal}</span>
              </p>
              <p className="flash-session-hint">
                {hintLabel}
                {!numbering && dueCount ? (
                  <span className="flash-due">
                    {" "}
                    · {dueCount} à revoir
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        {closed ? (
          <p className="flash-closed-banner" role="status">
            Cette carte est terminée
          </p>
        ) : null}

        <div className="flash-nav-row">
          <button
            type="button"
            className="flash-btn flash-nav-btn"
            aria-label="Carte précédente"
            disabled={!canGoPrev}
            onClick={() => go(-1)}
          >
            ←
          </button>

          <div
            className={`flash-viewport${dragging ? " is-dragging" : ""}${canNav ? " is-slidable" : ""}`}
            role="button"
            tabIndex={0}
            onPointerDown={onSlidePointerDown}
            onPointerMove={onSlidePointerMove}
            onPointerUp={finishSlidePointer}
            onPointerCancel={finishSlidePointer}
            aria-label={
              flipped
                ? "Voir la question — glisser ou utiliser les flèches pour changer de carte"
                : "Voir la réponse — Espace ou clic pour révéler"
            }
            aria-pressed={flipped}
          >
            <div
              className={`flash-track${dragging ? " is-dragging" : ""}`}
              style={{ transform: `translateX(calc(-${index * 100}% + ${dragX}px))` }}
            >
              {queue.map((item, slideIndex) => {
                const activeSlide = slideIndex === index;
                const slideFlipped = flippedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flash-slide${activeSlide ? " is-active" : ""}`}
                    aria-hidden={!activeSlide}
                  >
                    <div className="flash-stage">
                      <div className={`flash-inner${slideFlipped ? " is-flipped" : ""}`}>
                        <div className="flash-face flash-front">
                          <span className="flash-kicker">Référence</span>
                          <p className="flash-front-ref">{item.frente}</p>
                          {showRepetitionMeta ? <CardRepetitionMeta item={item} /> : null}
                          <span className="flash-reveal flash-reveal-click">Clic ou Espace pour révéler</span>
                          <span className="flash-reveal flash-reveal-touch">Toucher pour révéler</span>
                        </div>
                        <div className="flash-face flash-back">
                          <span className="flash-kicker is-answer">Texte</span>
                          <p className="flash-back-text">{item.verso}</p>
                          {showRepetitionMeta ? <CardRepetitionMeta item={item} /> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="flash-btn flash-nav-btn"
            aria-label="Carte suivante"
            disabled={!canGoNext}
            onClick={() => go(1)}
          >
            →
          </button>
        </div>

        {closed ? (
          <div className="flash-actions flash-actions--closed">
            <p className="flash-closed-copy">Hors des rappels de l’Inbox. Tu peux reprendre l’apprentissage.</p>
            <button
              type="button"
              className="flash-restart-btn"
              onClick={() => restartLearning()}
              disabled={sync === "saving"}
            >
              Reprendre l’apprentissage
            </button>
          </div>
        ) : !flipped ? (
          <div className="flash-actions flash-actions--reveal">
            <button type="button" className="flash-reveal-btn" onClick={() => toggleFlip()}>
              Montrer la réponse
              <kbd>Espace</kbd>
            </button>
          </div>
        ) : (
          <div className="flash-actions" role="group" aria-label="Classer la rétention">
            {(["dificil", "medio", "facil"] as const).map((level: RetentionMark) => {
              const key = MARK_KEYS[level];
              const hint = markHint(level, card, allowGraduation);
              return (
                <button
                  key={level}
                  type="button"
                  className={`flash-mark flash-mark--${level}${mark === level ? " is-on" : ""}${level === "medio" ? " is-default" : ""}`}
                  onClick={() => setMark(level)}
                  disabled={!grading}
                  aria-pressed={mark === level}
                  aria-keyshortcuts={level === "medio" ? `${key} Space` : key}
                  title={
                    level === "facil" && hint.interval === "Terminé"
                      ? `Elevé (2e fois) — termine le rappel et synchronise Notion (${key})`
                      : `${RETENTION_LABELS[level]} — prochain rappel ${hint.when} (${key}${level === "medio" ? " ou Espace" : ""})`
                  }
                >
                  <span className="flash-mark-key" aria-hidden="true">
                    {key}
                  </span>
                  <span className="flash-mark-label">{RETENTION_LABELS[level]}</span>
                  <small>
                    <span className="flash-mark-interval">{hint.interval}</span>
                    <span className="flash-mark-when"> · {hint.when}</span>
                  </small>
                </button>
              );
            })}
          </div>
        )}
        {sync === "saving" ? (
          <p className="flash-sync">Enregistrement de la connaissance et du rappel…</p>
        ) : null}
        {sync === "saved" ? <p className="flash-sync">Connaissance et rappel enregistrés</p> : null}
        {sync === "error" ? (
          <p className="flash-sync is-error" role="alert">
            {syncError ?? "Échec de la synchronisation Notion"}
          </p>
        ) : null}
      </div>
      {onBackToList ? (
        <button type="button" className="flash-list-back flash-review-back" onClick={onBackToList}>
          ← Retour
        </button>
      ) : null}
    </div>
  );
}

type FlashDeckListProps = {
  session: FlashcardSession;
  onPick?: (index: number) => void;
};

export function FlashDeckList({ session, onPick }: FlashDeckListProps) {
  const { queue, index, listRef, goTo, total, dueCount } = session;
  const countLabel =
    total === 0
      ? "Aucune carte"
      : dueCount
        ? `${total} carte${total === 1 ? "" : "s"} · ${dueCount} à revoir`
        : `${total} carte${total === 1 ? "" : "s"} · choisis pour réviser`;

  return (
    <nav className="flash-list flash-list--deck" ref={listRef} aria-label="Liste des cartes">
      <header className="flash-list-head">
        <p className="session-kicker">Liste</p>
        <h2 className="flash-list-heading">Cartes</h2>
        <p className="flash-list-meta-line">{countLabel}</p>
      </header>
      <ol className="flash-list-scroller">
        {queue.map((item, itemIndex) => {
          const activeItem = itemIndex === index;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`flash-list-item${activeItem ? " is-active" : ""}`}
                onClick={() => (onPick ? onPick(itemIndex) : goTo(itemIndex))}
                aria-current={activeItem ? "true" : undefined}
                aria-label={`Réviser la carte: ${item.frente}`}
              >
                <span className="flash-list-num">{itemIndex + 1}</span>
                <span className="flash-list-body">
                  <span className="flash-list-title">{item.frente}</span>
                  {item.status === "encerrado" ? (
                    <span className="flash-list-meta">
                      <span className="flash-list-status is-closed">Terminé</span>
                    </span>
                  ) : null}
                </span>
                <span className="flash-list-action" aria-hidden="true">
                  {item.status === "encerrado" ? "Voir" : "Réviser"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
