import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
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

/** Reduz o font-size até o texto caber no slot (sem scroll). */
function FlashFitText({
  text,
  className,
  minPx = 13,
  maxPx = 22,
}: {
  text: string;
  className?: string;
  minPx?: number;
  maxPx?: number;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const slot = el?.parentElement;
    if (!el || !slot) return;

    const fit = () => {
      const available = slot.clientHeight;
      if (available <= 0) return;

      let lo = minPx;
      let hi = maxPx;
      el.style.fontSize = `${hi}px`;
      if (el.scrollHeight <= available) return;

      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}px`;
        if (el.scrollHeight <= available) lo = mid;
        else hi = mid;
      }
      el.style.fontSize = `${lo}px`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slot);
    return () => ro.disconnect();
  }, [text, minPx, maxPx]);

  return (
    <p ref={ref} className={className}>
      {text}
    </p>
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
              style={
                canNav
                  ? {
                      transform: `translate3d(calc(var(--flash-peek) - ${slideIndex} * (100cqw - 2 * var(--flash-peek) + var(--flash-peek-gap)) + ${dragX}px), 0, 0)`,
                    }
                  : undefined
              }
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
                          <div className="flash-fit-slot">
                            <VerseCardFrontRef frente={item.frente} />
                          </div>
                          {showRepetitionMeta ? <CardRepetitionMeta item={item} /> : null}
                        </div>
                        <div className="flash-face flash-back">
                          <span className="flash-kicker is-passage-ref">
                            {formatVerseCardPlainRef(item.frente)}
                          </span>
                          <div className="flash-fit-slot">
                            <FlashFitText className="flash-back-text" text={item.verso} />
                          </div>
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
            {syncError ?? "Impossible d’enregistrer pour le moment"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type FlashDeckListProps = {
  session: FlashcardSession;
  onPick?: (index: number) => void;
  /** Titre accessible du panneau (Cartes). */
  title?: string;
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

/** Catégorie de date : Aujourd’hui / Hier / Demain, sinon jour de la semaine. */
function dayCategoryLabel(day: string, today = todayKey()): string {
  const relative = relativeDayLabel(day, today);
  const formatted = formatDay(day);
  if (relative) return `${relative} · ${formatted}`;
  const weekday = weekdayLabel(day);
  const titled = weekday ? weekday.charAt(0).toLocaleUpperCase("fr-FR") + weekday.slice(1) : "";
  return titled ? `${titled} · ${formatted}` : formatted;
}

/** Jours avec au moins une carte (lembrete), triés. */
function busyDaysFromCards(cards: Flashcard[]): string[] {
  const days = new Set<string>();
  for (const card of cards) {
    if (!card.lembrete) continue;
    days.add(dateKey(card.lembrete));
  }
  return [...days].sort();
}

function adjacentBusyDay(
  from: string,
  direction: 1 | -1,
  busyDays: string[],
): string | null {
  if (direction > 0) {
    return busyDays.find((day) => day > from) ?? null;
  }
  for (let i = busyDays.length - 1; i >= 0; i -= 1) {
    const day = busyDays[i]!;
    if (day < from) return day;
  }
  return null;
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
  focusCardId = null,
  focusSeq = 0,
}: FlashDeckListProps) {
  const { queue, index, listRef, goTo, total } = session;
  const [filter, setFilter] = useState<DeckProgressFilter>("nouveau");
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);
  const today = todayKey();
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);

  const nouveauCount = queue.filter((card) => cardMatchesDeckFilter(card, "nouveau")).length;
  const revisandoCount = queue.filter((card) => cardMatchesDeckFilter(card, "revisando")).length;
  const terminesCount = queue.filter((card) => cardMatchesDeckFilter(card, "termines")).length;
  const filterCounts: Record<DeckProgressFilter, number> = {
    nouveau: nouveauCount,
    revisando: revisandoCount,
    termines: terminesCount,
  };
  const statusFiltered = queue.filter((card) => cardMatchesDeckFilter(card, filter));
  /** Navigation ← → : tous les statuts (Nouveau / En révision / Terminé). */
  const allBusyDays = useMemo(() => busyDaysFromCards(queue), [queue]);
  const prevBusyDay = useMemo(
    () => adjacentBusyDay(selectedDay, -1, allBusyDays),
    [selectedDay, allBusyDays],
  );
  const nextBusyAcross = useMemo(
    () => adjacentBusyDay(selectedDay, 1, allBusyDays),
    [selectedDay, allBusyDays],
  );
  const dayCounts = useMemo(() => countsByDay(statusFiltered), [statusFiltered]);
  const weekDays = useMemo(() => weekDaysSunday(weekAnchor), [weekAnchor]);
  const dayCards = useMemo(
    () =>
      statusFiltered.filter(
        (card) => card.lembrete && dateKey(card.lembrete) === selectedDay,
      ),
    [statusFiltered, selectedDay],
  );
  const nodateCards = useMemo(
    () => statusFiltered.filter((card) => !card.lembrete),
    [statusFiltered],
  );
  const listCards = dayCards;
  const nextBusyInWeek = useMemo(() => {
    for (const day of weekDays) {
      if (day > selectedDay && (dayCounts.get(day) ?? 0) > 0) return day;
    }
    for (const day of weekDays) {
      if ((dayCounts.get(day) ?? 0) > 0) return day;
    }
    return null;
  }, [weekDays, dayCounts, selectedDay]);
  const nextBusyLabel = useMemo(() => {
    if (!nextBusyInWeek || nextBusyInWeek === selectedDay) return null;
    const parts = scheduleDayParts(nextBusyInWeek);
    const count = dayCounts.get(nextBusyInWeek) ?? 0;
    return `Aller au ${parts.weekday} ${parts.dayNum} · ${count} carte${count === 1 ? "" : "s"}`;
  }, [nextBusyInWeek, selectedDay, dayCounts]);
  const selectedDayTitle = dayCategoryLabel(selectedDay, today);
  const selectedOverdue = selectedDay < today && dayCards.length > 0;
  const selectedCount = dayCounts.get(selectedDay) ?? 0;

  useEffect(() => {
    if (!focusCardId || focusSeq <= 0) return;
    const focused = queue.find((card) => card.id === focusCardId);
    if (!focused) return;
    setFilter(filterForStatus(focused.status));
    if (focused.lembrete) {
      const day = dateKey(focused.lembrete);
      setSelectedDay(day);
      setWeekAnchor(day);
    }
  }, [focusCardId, focusSeq, queue]);

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

  /** Va au jour précédent/suivant qui a au moins une carte (tout statut). */
  function goToAdjacentBusyDay(direction: 1 | -1) {
    const target =
      direction > 0 ? nextBusyAcross : prevBusyDay;
    if (!target) return;
    selectDay(target);
    const onDay = queue.filter(
      (card) => card.lembrete && dateKey(card.lembrete) === target,
    );
    if (onDay.some((card) => cardMatchesDeckFilter(card, filter))) return;
    const first = onDay[0];
    if (first) setFilter(filterForStatus(first.status));
  }

  function shiftWeek(delta: number) {
    const nextSelected = shiftDay(selectedDay, delta * 7);
    setSelectedDay(nextSelected);
    setWeekAnchor(nextSelected);
  }

  function goThisWeek() {
    setWeekAnchor(today);
    setSelectedDay(today);
  }

  function onCalKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      goToAdjacentBusyDay(1);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      goToAdjacentBusyDay(-1);
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

  function onCalPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeOrigin.current = { x: event.clientX, y: event.clientY };
  }

  function onCalPointerUp(event: PointerEvent<HTMLDivElement>) {
    const origin = swipeOrigin.current;
    swipeOrigin.current = null;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    shiftWeek(dx < 0 ? 1 : -1);
  }

  function onCalPointerCancel() {
    swipeOrigin.current = null;
  }

  function renderCardButton(item: Flashcard) {
    const queueIndex = queue.findIndex((card) => card.id === item.id);
    const activeItem = queueIndex === index;
    const overdue = Boolean(item.lembrete && dateKey(item.lembrete) < today && item.status !== "encerrado");
    const statusLabel = STATUS_LABEL[item.status];
    const chipLabel = overdue ? "En retard" : null;
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
      className="flash-list flash-list--deck flash-list--plan"
      ref={listRef}
      aria-label={title}
    >
      <header className="flash-list-head">
        <div
          className="flash-deck-tabs"
          role="tablist"
          aria-label="Filtrer les cartes par progression"
        >
          {DECK_FILTERS.map((item) => {
            const count = filterCounts[item.id];
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`flash-deck-tab-${item.id}`}
                className={`flash-deck-tab${selected ? " is-on" : ""}${count === 0 ? " is-empty" : ""}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setFilter(item.id)}
                aria-label={`${item.label}, ${count} carte${count === 1 ? "" : "s"}`}
              >
                <span className="flash-deck-tab-label">{item.label}</span>
                <span className="flash-deck-tab-count" aria-hidden="true">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {!total ? <p className="flash-list-meta-line">Aucune carte</p> : null}
      </header>

      <div
        className="flash-cal"
        role="radiogroup"
        aria-label="Calendrier"
        onKeyDown={onCalKeyDown}
        onPointerDown={onCalPointerDown}
        onPointerUp={onCalPointerUp}
        onPointerCancel={onCalPointerCancel}
      >
        {weekDays.map((day) => {
          const parts = scheduleDayParts(day);
          const count = dayCounts.get(day) ?? 0;
          const isToday = day === today;
          const selected = day === selectedDay;
          const overdue = day < today && count > 0;
          const countLabel =
            count === 0 ? "aucune carte" : `${count} carte${count === 1 ? "" : "s"}`;
          return (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={[
                "flash-cal-day",
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
              <span className="flash-cal-dow" aria-hidden="true">
                {parts.weekday}
              </span>
              <span className="flash-cal-num" aria-hidden="true">
                {parts.dayNum}
              </span>
              <span className="flash-cal-markers" aria-hidden="true">
                {count > 0 ? (
                  <span className={`flash-cal-count${overdue ? " is-overdue" : ""}`}>
                    {count > 9 ? "9+" : count}
                  </span>
                ) : (
                  <span className="flash-cal-dot" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="flash-cal-live sr-only" aria-live="polite">
        {selectedDayTitle}
        {selectedCount
          ? `, ${selectedCount} carte${selectedCount === 1 ? "" : "s"}`
          : ", aucune carte"}
      </p>

      <div className="flash-plan-scroller">
        <section
          className={`flash-day-cards${selectedOverdue ? " is-overdue" : ""}`}
          aria-label={selectedDayTitle}
        >
          <div className="flash-day-cards-head">
            <button
              type="button"
              className="flash-day-nav-btn"
              aria-label="Jour précédent avec carte"
              disabled={!prevBusyDay}
              onClick={() => goToAdjacentBusyDay(-1)}
            >
              <ChevronLeftIcon className="flash-day-nav-icon" aria-hidden />
            </button>
            <div className="flash-day-cards-copy">
              <time dateTime={selectedDay}>{selectedDayTitle}</time>
              {selectedDay !== today ? (
                <button type="button" className="calendar-today" onClick={goThisWeek}>
                  Aujourd’hui
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="flash-day-nav-btn"
              aria-label="Jour suivant avec carte"
              disabled={!nextBusyAcross}
              onClick={() => goToAdjacentBusyDay(1)}
            >
              <ChevronRightIcon className="flash-day-nav-icon" aria-hidden />
            </button>
          </div>

          {listCards.length === 0 ? (
            <div className="flash-plan-empty-block">
              <p className="flash-plan-empty muted">
                {statusFiltered.length === 0
                  ? filter === "nouveau"
                    ? "Aucune nouvelle carte."
                    : filter === "termines"
                      ? "Aucune carte terminée."
                      : "Aucune carte en révision."
                  : "Aucune carte ce jour."}
              </p>
              {nextBusyLabel && nextBusyInWeek && statusFiltered.length > 0 ? (
                <button
                  type="button"
                  className="flash-plan-jump"
                  onClick={() => selectDay(nextBusyInWeek)}
                >
                  {nextBusyLabel}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="flash-plan-events flash-plan-events--cards">
              {listCards.map(renderCardButton)}
            </ul>
          )}

          {nodateCards.length > 0 && selectedDay === today ? (
            <div className="flash-nodate">
              <p className="flash-nodate-label muted">Sans date</p>
              <ul className="flash-plan-events flash-plan-events--cards">
                {nodateCards.map(renderCardButton)}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </nav>
  );
}
