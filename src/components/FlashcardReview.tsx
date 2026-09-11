import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { dateKey, formatDay, relativeDayLabel, scheduleDayParts, shiftDay, todayKey, weekDaysSunday, weekdayLabel } from "../calendar";
import {
  RETENTION_LABELS,
  RETENTION_MARKS,
  addDays,
  ankiIntervalDays,
  cardIntervalDays,
  lastReviewedOn,
} from "../retention";
import type { FlashcardSession } from "../flashcardSession";
import type { Flashcard, RetentionMark } from "../types";
import { chapterFocusFromRef, formatVerseCardPlainRef, formatVerseCardSpokenFront, parseVerseCardDisplay } from "../youversion/usfm";

type FlashcardReviewProps = {
  session: FlashcardSession;
  emptyMessage: string;
  /** Affiche la méta de répétition (dernière révision) — typique Timeline. */
  showRepetitionMeta?: boolean;
  /** Retour à la liste (écran séparé ; garde la session). */
  onBackToList?: () => void;
  /**
   * Numérotation explicite (ex. : position dans un jour).
   * Sinon, index de la session.
   */
  numbering?: {
    position: number;
    total: number;
    section?: string;
  };
  onRemoveCard?: (card: Flashcard) => void;
  /** Ouvre Lecture sur le chapitre de la référence. */
  onReadChapter?: (card: Flashcard) => void;
};

const MARK_KEYS: Record<RetentionMark, string> = {
  encore: "1",
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

function VerseCardFrontRef({ frente }: { frente: string }) {
  const parts = parseVerseCardDisplay(frente);
  if (!parts) {
    return <p className="flash-front-ref is-plain">{formatVerseCardSpokenFront(frente)}</p>;
  }
  return (
    <p className="flash-front-ref" aria-label={parts.spoken}>
      <span className="flash-ref-book">{parts.book}</span>
      <span className="flash-ref-line">
        <span className="flash-ref-pair">
          <span className="flash-ref-label">Chapitre</span>
          <span className="flash-ref-num">{parts.chapter}</span>
        </span>
        <span className="flash-ref-sep" aria-hidden="true">
          ·
        </span>
        <span className="flash-ref-pair">
          <span className="flash-ref-label">{parts.verseLabel}</span>
          <span className="flash-ref-num">{parts.versePart}</span>
        </span>
      </span>
    </p>
  );
}

function markHint(
  level: RetentionMark,
  card: Flashcard | null,
): { interval: string; when: string } {
  const prev = card ? cardIntervalDays(card) : 0;
  const days = ankiIntervalDays(level, prev);
  return { interval: `+${days}j`, when: formatDay(addDays(todayKey(), days)) };
}

function FlashCardMenu({
  archived = false,
  disabled,
  onArchive,
  onUnarchive,
  onDelete,
  onReadChapter,
}: {
  archived?: boolean;
  disabled?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  onReadChapter?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: globalThis.PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showArchive = Boolean(onArchive) && !archived;
  const showUnarchive = Boolean(onUnarchive) && archived;
  if (!showArchive && !showUnarchive && !onDelete && !onReadChapter) return null;

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
          {onReadChapter ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flash-card-menu-item"
                onClick={() => {
                  setOpen(false);
                  onReadChapter();
                }}
              >
                Lire le chapitre
              </button>
            </li>
          ) : null}
          {showArchive ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flash-card-menu-item"
                onClick={() => {
                  setOpen(false);
                  onArchive?.();
                }}
              >
                Archiver la carte
              </button>
            </li>
          ) : null}
          {showUnarchive ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flash-card-menu-item"
                onClick={() => {
                  setOpen(false);
                  onUnarchive?.();
                }}
              >
                Désarchiver
              </button>
            </li>
          ) : null}
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
  numbering,
  onRemoveCard,
  onReadChapter,
}: FlashcardReviewProps) {
  const {
    slideQueue,
    slideIndex,
    dayScope,
    total,
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

  const dayScoped = Boolean(dayScope) && !numbering;
  const displayTotal = numbering?.total ?? (dayScoped ? slideQueue.length : total);
  const displayPos =
    numbering?.position ?? (dayScoped ? slideIndex + 1 : index + 1);
  const safeTotal = Math.max(displayTotal, displayPos, 1);
  const progressPct = Math.min(100, (displayPos / safeTotal) * 100);
  const grading = flipped && sync !== "saving" && card.status !== "encerrado";
  const closed = card.status === "encerrado";
  const positionLabel = numbering?.section
    ? `${numbering.section}: carte ${displayPos} sur ${safeTotal}`
    : dayScoped
      ? `Carte ${displayPos} sur ${safeTotal} ce jour`
      : `Carte ${displayPos} sur ${safeTotal}`;
  const cardTint = card.color || undefined;
  const gradedThisTurn = sync === "saving" || sync === "saved";
  const rappelDay = card.lembrete ? dateKey(card.lembrete) : null;
  const rappelLabel = rappelDay
    ? relativeDayLabel(rappelDay) ?? formatDay(rappelDay)
    : "Sans date";

  return (
    <div
      className={`flash flash--solo flash--session${flipped ? " is-revealed" : ""}${closed ? " is-closed" : ""}${gradedThisTurn ? " is-graded" : ""}`}
      style={cardTint ? { ["--card-tint" as string]: cardTint } : undefined}
    >
      <header className="flash-session-top">
        {onBackToList ? (
          <button
            type="button"
            className="flash-session-back"
            onClick={onBackToList}
            aria-label="Retour à la liste"
          >
            ←
          </button>
        ) : (
          <span className="flash-session-top-slot" aria-hidden="true" />
        )}
        <span className="flash-session-top-center" aria-hidden="true" />
        <FlashCardMenu
          archived={closed}
          disabled={sync === "saving"}
          onArchive={archiveCard}
          onUnarchive={restartLearning}
          onDelete={onRemoveCard ? () => onRemoveCard(card) : undefined}
          onReadChapter={
            onReadChapter && chapterFocusFromRef(card.frente)
              ? () => onReadChapter(card)
              : undefined
          }
        />
      </header>

      <div className="flash-main">
        <div className="flash-session-meter" aria-live="polite">
          <p className="flash-session-count" aria-label={positionLabel}>
            <span className="flash-session-current">{displayPos}</span>
            <span className="flash-session-of">/</span>
            <span className="flash-session-total">{safeTotal}</span>
          </p>
          <div className="flash-session-meter-respiro" aria-hidden="true">
            <div
              className="flash-progress"
              role="progressbar"
              aria-label="Progression de la session"
              aria-valuemin={0}
              aria-valuemax={safeTotal}
              aria-valuenow={displayPos}
              aria-valuetext={`Carte ${displayPos} sur ${safeTotal}`}
            >
              <i style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <p
            className={`flash-session-rappel${rappelDay ? " is-set" : ""}`}
            aria-label={rappelDay ? `Date de rappel · ${rappelLabel}` : "Sans date de rappel"}
            title={
              gradedThisTurn && mark
                ? `${RETENTION_LABELS[mark]} · ${rappelLabel}`
                : `Date de rappel · ${rappelLabel}`
            }
          >
            {rappelLabel}
          </p>
        </div>

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
              style={{
                transform: canNav
                  ? `translate3d(calc(var(--flash-peek) - ${slideIndex} * (100cqw - 2 * var(--flash-peek) + var(--flash-peek-gap)) + ${dragX}px), 0, 0)`
                  : `translate3d(${dragX}px, 0, 0)`,
              }}
            >
              {slideQueue.map((item) => {
                const activeSlide = item.id === card.id;
                const slideFlipped = flippedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flash-slide${activeSlide ? " is-active" : ""}`}
                    aria-hidden={!activeSlide}
                  >
                    <div
                      className="flash-stage"
                      style={
                        item.color
                          ? { ["--card-tint" as string]: item.color }
                          : undefined
                      }
                    >
                      <div className={`flash-inner${slideFlipped ? " is-flipped" : ""}`}>
                        <div className="flash-face flash-front">
                          <VerseCardFrontRef frente={item.frente} />
                          {showRepetitionMeta ? <CardRepetitionMeta item={item} /> : null}
                        </div>
                        <div className="flash-face flash-back">
                          <span className="flash-kicker is-passage-ref">
                            {formatVerseCardPlainRef(item.frente)}
                          </span>
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
            <p className="flash-closed-status" role="status">
              Cette carte est terminée
            </p>
          </div>
        ) : !flipped ? (
          <div className="flash-actions flash-actions--reveal">
            <button type="button" className="flash-reveal-btn" onClick={() => toggleFlip()}>
              Montrer la réponse
              <kbd>Espace</kbd>
            </button>
          </div>
        ) : (
          <div
            className="flash-actions"
            role="group"
            aria-label={card.status === "espera" ? "Commencer la révision" : "Répétition espacée"}
          >
            {RETENTION_MARKS.map((level: RetentionMark) => {
              const key = MARK_KEYS[level];
              const hint = markHint(level, card);
              return (
                <button
                  key={level}
                  type="button"
                  className={`flash-mark flash-mark--${level}${mark === level ? " is-on" : ""}${level === "medio" ? " is-default" : ""}`}
                  onClick={() => setMark(level)}
                  disabled={!grading}
                  aria-pressed={mark === level}
                  aria-keyshortcuts={level === "medio" ? `${key} Space` : key}
                  title={`${RETENTION_LABELS[level]} — prochain rappel ${hint.when} (${key}${level === "medio" ? " ou Espace" : ""})`}
                >
                  <span className="flash-mark-label">{RETENTION_LABELS[level]}</span>
                </button>
              );
            })}
          </div>
        )}
        {sync === "error" ? (
          <p className="flash-sync is-error" role="alert">
            {syncError ?? "Échec de la synchronisation Notion"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type FlashDeckListProps = {
  session: FlashcardSession;
  onPick?: (index: number) => void;
  /** Titre accessible du panneau (Cartes / Timeline). */
  title?: string;
  /** Bandeau hebdomadaire (filtre par jour) — Timeline. */
  showWeekSchedule?: boolean;
  /** Aligne le filtre Nouveau/En révision/Terminé sur une carte (Visualiser). */
  focusCardId?: string | null;
  focusSeq?: number;
};

type DeckProgressFilter = "nouveau" | "revisando" | "termines";

const DECK_FILTERS: { id: DeckProgressFilter; label: string }[] = [
  { id: "nouveau", label: "Nouveau" },
  { id: "revisando", label: "En révision" },
  { id: "termines", label: "Terminé" },
];

const STATUS_LABEL: Record<Flashcard["status"], string> = {
  espera: "Nouveau",
  estudo: "En révision",
  encerrado: "Terminé",
};

function filterForStatus(status: Flashcard["status"]): DeckProgressFilter {
  if (status === "espera") return "nouveau";
  if (status === "encerrado") return "termines";
  return "revisando";
}

function cardMatchesDeckFilter(card: Flashcard, filter: DeckProgressFilter): boolean {
  if (filter === "nouveau") return card.status === "espera";
  if (filter === "termines") return card.status === "encerrado";
  return card.status === "estudo";
}

function countsByDay(cards: Flashcard[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (!card.lembrete) continue;
    const day = dateKey(card.lembrete);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

export function FlashDeckList({
  session,
  onPick,
  title = "Cartes",
  showWeekSchedule = false,
  focusCardId = null,
  focusSeq = 0,
}: FlashDeckListProps) {
  const { queue, index, listRef, goTo, total } = session;
  const [filter, setFilter] = useState<DeckProgressFilter>("nouveau");
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);
  const today = todayKey();
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);

  useEffect(() => {
    if (!focusCardId || focusSeq <= 0) return;
    const focused = queue.find((card) => card.id === focusCardId);
    if (focused) setFilter(filterForStatus(focused.status));
  }, [focusCardId, focusSeq, queue]);

  const nouveauCount = queue.filter((card) => cardMatchesDeckFilter(card, "nouveau")).length;
  const revisandoCount = queue.filter((card) => cardMatchesDeckFilter(card, "revisando")).length;
  const terminesCount = queue.filter((card) => cardMatchesDeckFilter(card, "termines")).length;
  const filterCounts: Record<DeckProgressFilter, number> = {
    nouveau: nouveauCount,
    revisando: revisandoCount,
    termines: terminesCount,
  };
  const showFilters = !showWeekSchedule;
  const visible = showWeekSchedule
    ? queue.filter((card) => card.status !== "encerrado")
    : queue.filter((card) => cardMatchesDeckFilter(card, filter));
  const dayCounts = useMemo(() => countsByDay(visible), [visible]);
  const weekDays = useMemo(() => weekDaysSunday(weekAnchor), [weekAnchor]);
  const dayCards = useMemo(
    () => visible.filter((card) => card.lembrete && dateKey(card.lembrete) === selectedDay),
    [visible, selectedDay],
  );
  const nodateCards = useMemo(() => visible.filter((card) => !card.lembrete), [visible]);
  const listCards = showWeekSchedule ? dayCards : visible;
  const nextBusyDay = useMemo(() => {
    for (const day of weekDays) {
      if (day > selectedDay && (dayCounts.get(day) ?? 0) > 0) return day;
    }
    for (const day of weekDays) {
      if ((dayCounts.get(day) ?? 0) > 0) return day;
    }
    return null;
  }, [weekDays, dayCounts, selectedDay]);
  const nextBusyLabel = useMemo(() => {
    if (!nextBusyDay || nextBusyDay === selectedDay) return null;
    const parts = scheduleDayParts(nextBusyDay);
    const count = dayCounts.get(nextBusyDay) ?? 0;
    return `Aller au ${parts.weekday} ${parts.dayNum} · ${count} carte${count === 1 ? "" : "s"}`;
  }, [nextBusyDay, selectedDay, dayCounts]);
  const selectedRelative = relativeDayLabel(selectedDay, today);
  const selectedOverdue = selectedDay < today && dayCards.length > 0;
  const selectedCount = dayCounts.get(selectedDay) ?? 0;

  function pickCard(card: Flashcard) {
    const queueIndex = queue.findIndex((item) => item.id === card.id);
    if (queueIndex < 0) return;
    if (onPick) onPick(queueIndex);
    else goTo(queueIndex);
  }

  function selectDay(day: string) {
    setSelectedDay(day);
    setWeekAnchor(day);
  }

  function shiftWeek(delta: number) {
    const next = shiftDay(weekAnchor, delta * 7);
    setWeekAnchor(next);
    setSelectedDay(shiftDay(selectedDay, delta * 7));
  }

  function goThisWeek() {
    setWeekAnchor(today);
    setSelectedDay(today);
  }

  function onWeekKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectDay(shiftDay(selectedDay, 1));
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectDay(shiftDay(selectedDay, -1));
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      shiftWeek(1);
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      shiftWeek(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      goThisWeek();
    }
  }

  function onWeekPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeOrigin.current = { x: event.clientX, y: event.clientY };
  }

  function onWeekPointerUp(event: PointerEvent<HTMLDivElement>) {
    const origin = swipeOrigin.current;
    swipeOrigin.current = null;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    shiftWeek(dx < 0 ? 1 : -1);
  }

  function onWeekPointerCancel() {
    swipeOrigin.current = null;
  }

  function renderCardButton(item: Flashcard) {
    const queueIndex = queue.findIndex((card) => card.id === item.id);
    const activeItem = queueIndex === index;
    const overdue = Boolean(item.lembrete && dateKey(item.lembrete) < today && item.status !== "encerrado");
    const statusLabel = STATUS_LABEL[item.status];
    const chipLabel = overdue ? "En retard" : showWeekSchedule ? statusLabel : null;
    return (
      <li key={item.id} className="flash-plan-row">
        <button
          type="button"
          className={`flash-plan-event${activeItem ? " is-active" : ""}${
            item.status === "encerrado" ? " is-closed" : ""
          }${overdue ? " is-overdue" : ""}`}
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
              ? `Voir la carte terminée: ${item.frente}`
              : overdue
                ? `Réviser (en retard): ${item.frente}`
                : `Réviser la carte: ${item.frente} · ${statusLabel}`
          }
        >
          <span className="flash-plan-event-title">{item.frente}</span>
          {chipLabel ? (
            <span
              className={`flash-list-status${item.status === "encerrado" ? " is-closed" : ""}${
                overdue ? " is-overdue" : ""
              }${item.status === "espera" ? " is-nouveau" : ""}${item.status === "estudo" ? " is-estudo" : ""}`}
            >
              {chipLabel}
            </span>
          ) : null}
        </button>
      </li>
    );
  }

  return (
    <nav
      className={`flash-list flash-list--deck${showWeekSchedule ? " flash-list--plan" : ""}`}
      ref={listRef}
      aria-label={showWeekSchedule ? "Planning des rappels" : title}
    >
      {showFilters || !total ? (
        <header className="flash-list-head">
          {showFilters ? (
            <div
              className="flash-deck-segments"
              role="group"
              aria-label="Filtrer les cartes par progression"
            >
              {DECK_FILTERS.map((item) => {
                const count = filterCounts[item.id];
                const on = item.id === filter;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`flash-deck-segment${on ? " is-on" : ""}${count === 0 ? " is-empty" : ""}`}
                    aria-pressed={on}
                    onClick={() => setFilter(item.id)}
                  >
                    <span className="flash-deck-segment-label">{item.label}</span>
                    <span className="flash-deck-segment-count" aria-hidden="true">
                      {count}
                    </span>
                    <span className="sr-only">
                      {`, ${count} carte${count === 1 ? "" : "s"}`}
                      {on ? ", sélectionné" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {!total ? <p className="flash-list-meta-line">Aucune carte</p> : null}
        </header>
      ) : null}

      {showWeekSchedule ? (
        <>
          <div
            className="flash-week"
            role="radiogroup"
            aria-label="Jours de la semaine"
            onKeyDown={onWeekKeyDown}
            onPointerDown={onWeekPointerDown}
            onPointerUp={onWeekPointerUp}
            onPointerCancel={onWeekPointerCancel}
          >
            {weekDays.map((day) => {
              const parts = scheduleDayParts(day);
              const count = dayCounts.get(day) ?? 0;
              const isToday = day === today;
              const selected = day === selectedDay;
              const overdue = day < today && count > 0;
              const countLabel = count === 0 ? "aucune carte" : `${count} carte${count === 1 ? "" : "s"}`;
              return (
                <button
                  key={day}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className={[
                    "flash-week-day",
                    isToday ? "is-today" : "",
                    selected ? "is-selected" : "",
                    count ? "has-cards" : "is-empty",
                    overdue ? "is-overdue" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectDay(day)}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${weekdayLabel(day)} ${formatDay(day)}, ${countLabel}`}
                >
                  <span className="flash-week-dow" aria-hidden="true">
                    {parts.weekday}
                  </span>
                  <span className="flash-week-num" aria-hidden="true">
                    {parts.dayNum}
                  </span>
                  <span className="flash-week-markers" aria-hidden="true">
                    {count > 0 ? (
                      <span className={`flash-week-count${overdue ? " is-overdue" : ""}`}>
                        {count > 9 ? "9+" : count}
                      </span>
                    ) : (
                      <span className="flash-week-dot" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="flash-week-live sr-only" aria-live="polite">
            {weekdayLabel(selectedDay)} {formatDay(selectedDay)}
            {selectedCount
              ? `, ${selectedCount} carte${selectedCount === 1 ? "" : "s"}`
              : ", aucune carte"}
          </p>
        </>
      ) : null}

      <div className={showWeekSchedule ? "flash-plan-scroller" : "flash-list-scroller"}>
        {showWeekSchedule ? (
          <section
            className={`flash-day-cards${selectedOverdue ? " is-overdue" : ""}`}
            aria-label={
              selectedRelative
                ? `${selectedRelative} · ${formatDay(selectedDay)}`
                : formatDay(selectedDay)
            }
          >
            <p className="flash-day-cards-head">
              <time dateTime={selectedDay}>
                {selectedRelative ? `${selectedRelative} · ${formatDay(selectedDay)}` : formatDay(selectedDay)}
              </time>
              {selectedDay !== today ? (
                <button type="button" className="calendar-today" onClick={goThisWeek}>
                  Aujourd’hui
                </button>
              ) : null}
            </p>

            {listCards.length === 0 ? (
              <div className="flash-plan-empty-block">
                <p className="flash-plan-empty muted">Aucune carte ce jour.</p>
                {nextBusyLabel && nextBusyDay ? (
                  <button type="button" className="flash-plan-jump" onClick={() => selectDay(nextBusyDay)}>
                    {nextBusyLabel}
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="flash-plan-events flash-plan-events--cards">{listCards.map(renderCardButton)}</ul>
            )}

            {nodateCards.length > 0 && selectedDay === today ? (
              <div className="flash-nodate">
                <p className="flash-nodate-label muted">Sans date</p>
                <ul className="flash-plan-events flash-plan-events--cards">{nodateCards.map(renderCardButton)}</ul>
              </div>
            ) : null}
          </section>
        ) : visible.length === 0 ? (
          <div className="flash-plan-empty-block">
            <p className="flash-plan-empty muted">
              {filter === "nouveau"
                ? "Aucune nouvelle carte."
                : filter === "termines"
                  ? "Aucune carte terminée."
                  : "Aucune carte en révision."}
            </p>
          </div>
        ) : (
          <ul className="flash-plan-events flash-plan-events--cards">{visible.map(renderCardButton)}</ul>
        )}
      </div>
    </nav>
  );
}
