import { useEffect, useMemo, useRef, useState } from "react";
import { dateKey, formatDay, relativeDayLabel, scheduleDayParts, todayKey } from "../calendar";
import { loadOverride } from "../flashcardSync";
import {
  FACIL_GRADUATION,
  RETENTION_LABELS,
  RETENTION_MARKS,
  addDays,
  ankiIntervalDays,
  cardIntervalDays,
  lastReviewedOn,
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
  onRemoveCard?: (card: Flashcard) => void;
};

const MARK_KEYS: Record<RetentionMark, string> = {
  encore: "1",
  dificil: "2",
  medio: "3",
  facil: "4",
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
  const prev = card ? cardIntervalDays(card) : 0;
  const days = ankiIntervalDays(level, prev);
  return { interval: `+${days}j`, when: formatDay(addDays(todayKey(), days)) };
}

function FlashCardMenu({
  canArchive,
  disabled,
  onArchive,
  onDelete,
}: {
  canArchive: boolean;
  disabled?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!onArchive && !onDelete) return null;

  return (
    <div
      className={`flash-card-menu${open ? " is-open" : ""}`}
      ref={rootRef}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="flash-card-menu-trigger"
        aria-label="Options de la carte"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        ⋮
      </button>
      {open ? (
        <ul className="flash-card-menu-list" role="menu">
          {onDelete ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flash-card-menu-item is-danger"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                Supprimer la carte
              </button>
            </li>
          ) : null}
          {onArchive && canArchive ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flash-card-menu-item"
                onClick={() => {
                  setOpen(false);
                  onArchive();
                }}
              >
                Archiver la carte
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export function FlashcardReview({
  session,
  emptyMessage,
  showRepetitionMeta = false,
  onBackToList,
  allowGraduation = true,
  numbering,
  onRemoveCard,
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
    archiveCard,
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
                    <div
                      className="flash-stage"
                      style={item.color ? { ["--card-tint" as string]: item.color } : undefined}
                    >
                      {item.color ? (
                        <span
                          className="flash-card-tint"
                          style={{ background: item.color }}
                          title="Couleur"
                          aria-hidden="true"
                        />
                      ) : null}
                      {activeSlide ? (
                        <FlashCardMenu
                          canArchive={item.status !== "encerrado"}
                          disabled={sync === "saving"}
                          onArchive={archiveCard}
                          onDelete={onRemoveCard ? () => onRemoveCard(item) : undefined}
                        />
                      ) : null}
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
          <div className="flash-actions" role="group" aria-label="Répétition espacée">
            {RETENTION_MARKS.map((level: RetentionMark) => {
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
                      ? `Facile (2e fois) — termine le rappel et synchronise Notion (${key})`
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
          <p className="flash-sync">Enregistrement de la répétition et du rappel…</p>
        ) : null}
        {sync === "saved" ? <p className="flash-sync">Répétition et rappel enregistrés</p> : null}
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
  onRemoveCard?: (card: Flashcard) => void;
};

type DeckProgressFilter = "revisando" | "concluidos";

const DECK_FILTERS: { id: DeckProgressFilter; label: string }[] = [
  { id: "revisando", label: "En révision" },
  { id: "concluidos", label: "Terminés" },
];

function cardMatchesDeckFilter(card: Flashcard, filter: DeckProgressFilter): boolean {
  if (filter === "concluidos") return card.status === "encerrado";
  return card.status !== "encerrado";
}

function groupCardsBySchedule(cards: Flashcard[]): { day: string | null; items: Flashcard[] }[] {
  const byDay = new Map<string, Flashcard[]>();
  const nodate: Flashcard[] = [];
  for (const card of cards) {
    const day = card.lembrete ? dateKey(card.lembrete) : null;
    if (!day) {
      nodate.push(card);
      continue;
    }
    const bucket = byDay.get(day) ?? [];
    bucket.push(card);
    byDay.set(day, bucket);
  }
  const groups = [...byDay.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((day) => ({ day, items: byDay.get(day)! }));
  if (nodate.length) groups.push({ day: null, items: nodate });
  return groups;
}

export function FlashDeckList({ session, onPick, onRemoveCard }: FlashDeckListProps) {
  const { queue, index, listRef, goTo, total } = session;
  const [filter, setFilter] = useState<DeckProgressFilter>("revisando");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const today = todayKey();

  const revisandoCount = queue.filter((card) => cardMatchesDeckFilter(card, "revisando")).length;
  const concluidosCount = queue.filter((card) => cardMatchesDeckFilter(card, "concluidos")).length;
  const visible = queue.filter((card) => cardMatchesDeckFilter(card, filter));
  const scheduleGroups = useMemo(() => groupCardsBySchedule(visible), [visible]);
  const activeFilter = DECK_FILTERS.find((item) => item.id === filter) ?? DECK_FILTERS[0]!;

  const countLabel =
    visible.length === 0
      ? filter === "concluidos"
        ? "Aucune carte terminée"
        : "Aucune carte en révision"
      : filter === "concluidos"
        ? `${visible.length} carte${visible.length === 1 ? "" : "s"} terminée${visible.length === 1 ? "" : "s"}`
        : `${visible.length} carte${visible.length === 1 ? "" : "s"} en révision`;

  useEffect(() => {
    if (!filterOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (filterRef.current?.contains(event.target as Node)) return;
      setFilterOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setFilterOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (filter === "revisando" && revisandoCount === 0 && concluidosCount > 0) {
      setFilter("concluidos");
    } else if (filter === "concluidos" && concluidosCount === 0 && revisandoCount > 0) {
      setFilter("revisando");
    }
  }, [filter, revisandoCount, concluidosCount]);

  function pickCard(card: Flashcard) {
    const queueIndex = queue.findIndex((item) => item.id === card.id);
    if (queueIndex < 0) return;
    if (onPick) onPick(queueIndex);
    else goTo(queueIndex);
  }

  return (
    <nav className="flash-list flash-list--deck flash-list--plan" ref={listRef} aria-label="Planning des cartes">
      <header className="flash-list-head">
        <h2 className="flash-list-heading">Cartes</h2>
        <div className={`flash-deck-filter${filterOpen ? " is-open" : ""}`} ref={filterRef}>
          <button
            type="button"
            className="flash-deck-filter-trigger"
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            aria-label="Filtrer par progression"
            onClick={() => setFilterOpen((open) => !open)}
          >
            <span className="flash-deck-filter-value">
              {activeFilter.label}
              <span className="flash-deck-filter-caret" aria-hidden="true" />
            </span>
            <span className="flash-deck-filter-count">{countLabel}</span>
          </button>
          {filterOpen ? (
            <ul className="flash-deck-filter-menu" role="listbox" aria-label="Progression">
              {DECK_FILTERS.map((item) => {
                const count = item.id === "concluidos" ? concluidosCount : revisandoCount;
                const on = item.id === filter;
                return (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={`flash-deck-filter-option${on ? " is-on" : ""}`}
                      onClick={() => {
                        setFilter(item.id);
                        setFilterOpen(false);
                      }}
                    >
                      <span>{item.label}</span>
                      <span className="flash-deck-filter-option-count">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        {!total ? <p className="flash-list-meta-line">Aucune carte</p> : null}
      </header>
      <div className="flash-plan-scroller">
        {scheduleGroups.length === 0 ? (
          <p className="flash-plan-empty muted">
            {filter === "concluidos" ? "Aucune carte terminée." : "Aucune carte en révision."}
          </p>
        ) : (
          scheduleGroups.map((group) => {
            const day = group.day;
            const parts = day ? scheduleDayParts(day) : null;
            const relative = day ? relativeDayLabel(day, today) : null;
            const isToday = day === today;
            const overdue = Boolean(day && day < today && filter === "revisando");
            return (
              <section
                key={day ?? "nodate"}
                className={`flash-plan-day${isToday ? " is-today" : ""}${overdue ? " is-overdue" : ""}`}
                aria-label={
                  day
                    ? relative
                      ? `${relative} · ${formatDay(day)}`
                      : formatDay(day)
                    : "Sans date"
                }
              >
                <div className="flash-plan-date" aria-hidden={false}>
                  {parts ? (
                    <>
                      <span className="flash-plan-dow">{parts.weekday}</span>
                      <span className={`flash-plan-num${isToday ? " is-today" : ""}`}>{parts.dayNum}</span>
                    </>
                  ) : (
                    <>
                      <span className="flash-plan-dow">—</span>
                      <span className="flash-plan-num is-nodate">·</span>
                    </>
                  )}
                </div>
                <ul className="flash-plan-events">
                  {group.items.map((item) => {
                    const queueIndex = queue.findIndex((card) => card.id === item.id);
                    const activeItem = queueIndex === index;
                    const meta =
                      item.status === "encerrado"
                        ? "Terminé"
                        : overdue
                          ? "En retard"
                          : relative
                            ? relative
                            : item.lembrete
                              ? `Rappel · ${formatDay(item.lembrete)}`
                              : "Sans rappel";
                    return (
                      <li key={item.id} className="flash-plan-row">
                        <button
                          type="button"
                          className={`flash-plan-event${activeItem ? " is-active" : ""}${item.status === "encerrado" ? " is-closed" : ""}`}
                          style={
                            item.color
                              ? {
                                  ["--card-tint" as string]: item.color,
                                  background: `color-mix(in srgb, ${item.color} 28%, var(--panel))`,
                                }
                              : undefined
                          }
                          onClick={() => pickCard(item)}
                          aria-current={activeItem ? "true" : undefined}
                          aria-label={
                            item.status === "encerrado"
                              ? `Voir la carte: ${item.frente}`
                              : `Réviser la carte: ${item.frente}`
                          }
                        >
                          <span className="flash-plan-event-title">{item.frente}</span>
                          <span className="flash-plan-event-meta">{meta}</span>
                        </button>
                        {onRemoveCard ? (
                          <button
                            type="button"
                            className="flash-list-remove"
                            aria-label={`Supprimer ${item.frente}`}
                            title="Supprimer"
                            onClick={() => onRemoveCard(item)}
                          >
                            Supprimer
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </nav>
  );
}
