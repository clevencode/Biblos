import { useMemo, useState } from "react";
import {
  buildMonthGrid,
  formatDay,
  monthLabel,
  todayKey,
} from "../calendar";
import { isPassageRef } from "../youversion/usfm";
import {
  dateForPlanJour,
  dayEntry,
  planJourForDate,
  progressCounts,
  type PlanProgress,
} from "../planProgress";
import type { CalendarCardItem, PlanDay, ReadingPlan } from "../types";
import { isPassageReminder } from "../passageReminder";

type CalendarViewProps = {
  cards: CalendarCardItem[];
  cardCounts: ReadonlyMap<string, number>;
  onPickCard: (item: CalendarCardItem) => void;
  active?: boolean;
  /** Ignoré : calendrier + verset restent sur un seul écran. */
  splitLayout?: boolean;
  plan?: ReadingPlan | null;
  progress?: PlanProgress | null;
  planJour?: number;
  onMarkRead?: (jour: number) => void;
  onOpenPassage?: (reference: string) => void;
};

const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Extrait une référence biblique du jour (Texte, éventuellement collé au Défi). */
function resolvePlanPassageRef(day: PlanDay): string | null {
  const candidates = [day.texte, day.defi, `${day.texte} ${day.defi}`];
  for (const raw of candidates) {
    const cleaned = String(raw || "")
      .replace(/\*\*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;
    if (isPassageRef(cleaned)) return cleaned;
    const match = cleaned.match(
      /(?:[123]\s+)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*){0,3}\s+\d+(?:[.:]\d+(?:\s*[-–—]\s*\d+)?)?/,
    );
    if (match && isPassageRef(match[0])) return match[0].trim();
  }
  return null;
}

function monthOf(day: string) {
  const date = new Date(`${day}T00:00:00`);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function PlanProgressMeta({
  jour,
  done,
  total,
}: {
  jour: number;
  done: number;
  total: number;
}) {
  if (!total) return null;
  return (
    <p className="calendar-plan-progress" aria-live="polite">
      <span className="page-session-status">Jour {jour}</span>
      <span>
        {" "}
        Progression · {done}/{total}
      </span>
    </p>
  );
}

export function CalendarView({
  cards,
  cardCounts,
  onPickCard,
  plan = null,
  progress = null,
  planJour = 1,
  onMarkRead,
  onOpenPassage,
}: CalendarViewProps) {
  const today = todayKey();
  const [selectedDay, setSelectedDay] = useState(today);
  const [cursor, setCursor] = useState(() => monthOf(today));
  const cells = buildMonthGrid(cursor.year, cursor.month);

  const dayCards = useMemo(
    () => cards.filter((item) => item.day === selectedDay),
    [cards, selectedDay],
  );

  const { done, total } = progressCounts(plan, progress);

  const planDayKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!plan?.days.length || !progress?.startDate) return keys;
    for (const day of plan.days) {
      keys.add(dateForPlanJour(progress.startDate, day.jour));
    }
    return keys;
  }, [plan, progress?.startDate]);

  const selectedPlanJour =
    plan && progress
      ? planJourForDate(progress.startDate, selectedDay, plan.days.length)
      : null;
  const planDay = plan && selectedPlanJour ? dayEntry(plan, selectedPlanJour) : null;
  const isRead = selectedPlanJour
    ? (progress?.completedDays.includes(selectedPlanJour) ?? false)
    : false;
  const passageRef = planDay ? resolvePlanPassageRef(planDay) : null;

  function shift(delta: number) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function selectDay(day: string) {
    setSelectedDay(day);
    setCursor(monthOf(day));
  }

  function goToday() {
    selectDay(today);
  }

  return (
    <div className="calendar-view calendar-view--unified">
      <div className="calendar-unified-scroll">
        <section className="calendar-panel" aria-label="Calendário mensal">
          <header className="calendar-month-head">
            <p className="session-kicker">Agenda</p>
            <PlanProgressMeta jour={planJour || 1} done={done} total={total} />
            <div className="calendar-nav">
              <button type="button" className="flash-btn" onClick={() => shift(-1)} aria-label="Mois précédent">
                ←
              </button>
              <strong>{monthLabel(cursor.year, cursor.month)}</strong>
              <button type="button" className="flash-btn" onClick={() => shift(1)} aria-label="Mois suivant">
                →
              </button>
            </div>
          </header>
          <div className="calendar-legend" aria-hidden="true">
            <span className="calendar-legend-item is-card">Rappel</span>
            {total ? <span className="calendar-legend-item is-plan">Plan</span> : null}
          </div>
          <div className="calendar-grid" role="grid" aria-label="Calendário">
            {weekdays.map((day) => (
              <span key={day} className="calendar-dow" role="columnheader">
                {day}
              </span>
            ))}
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="calendar-cell is-empty" />;
              const cardCount = cardCounts.get(day) ?? 0;
              const overdue = day < today && cardCount > 0;
              const selected = day === selectedDay;
              const isPlanDay = planDayKeys.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    "calendar-cell",
                    day === today ? "is-today" : "",
                    selected ? "is-selected" : "",
                    cardCount ? "has-events" : "is-muted",
                    overdue ? "is-overdue" : "",
                    isPlanDay ? "is-plan-day" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectDay(day)}
                  aria-pressed={selected}
                  aria-label={`${formatDay(day)}${cardCount ? `, ${cardCount} lembrete${cardCount === 1 ? "" : "s"}` : ""}${isPlanDay ? ", jour du plan" : ""}`}
                >
                  <span className="calendar-day-num">{Number(day.slice(8))}</span>
                  <span className="calendar-markers">
                    {cardCount ? (
                      <span className={`calendar-count${overdue ? " is-overdue" : ""}`}>
                        {cardCount > 9 ? "9+" : cardCount}
                      </span>
                    ) : null}
                    {isPlanDay ? <span className="calendar-plan-dot" aria-hidden="true" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" className="calendar-today" onClick={goToday}>
            Aujourd’hui
          </button>
        </section>

        <section className="calendar-day-strip" aria-label={`Jour sélectionné · ${formatDay(selectedDay)}`}>
          <p className="calendar-day-strip-date">
            <time dateTime={selectedDay}>{formatDay(selectedDay)}</time>
          </p>

          {planDay ? (
            <article className="calendar-plan-day">
              {passageRef ? (
                <p className="calendar-plan-ref">{passageRef}</p>
              ) : null}
              <div className="calendar-plan-actions">
                {onMarkRead && selectedPlanJour ? (
                  <button
                    type="button"
                    className={`flash-btn calendar-plan-lu${isRead ? " is-done" : ""}`}
                    onClick={() => onMarkRead(selectedPlanJour)}
                    aria-pressed={isRead}
                    aria-label={isRead ? "Démarquer comme lu" : "Marquer comme lu"}
                  >
                    <span className="calendar-plan-lu-check" aria-hidden="true">
                      {isRead ? "✓" : "○"}
                    </span>
                    {isRead ? "Démarquer" : "Marquer comme lu"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flash-btn calendar-plan-lire"
                  disabled={!passageRef || !onOpenPassage}
                  onClick={() => {
                    if (passageRef) onOpenPassage?.(passageRef);
                  }}
                >
                  Lire le passage
                </button>
              </div>
            </article>
          ) : null}

          {dayCards.length ? (
            <ol className="calendar-agenda-list">
              {dayCards.map((item, index) => {
                const passage = isPassageReminder(item.title, item.cardCategory);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`calendar-agenda-item${passage ? " is-passage" : ""}`}
                      onClick={() => onPickCard(item)}
                      aria-label={
                        passage ? `Lire le passage: ${item.title}` : `Réviser la carte: ${item.title}`
                      }
                    >
                      <span className="calendar-agenda-num">{index + 1}</span>
                      <span className="calendar-agenda-body">
                        <span className="calendar-agenda-title">{item.title}</span>
                        <span className="calendar-agenda-meta">
                          <span className="calendar-agenda-disciplina">{item.disciplinaNome}</span>
                          <span className="calendar-agenda-materia">{item.materiaNome}</span>
                        </span>
                      </span>
                      <span className="calendar-agenda-action" aria-hidden="true">
                        {passage ? "Lire" : "Rever"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : !planDay ? (
            <p className="muted calendar-day-strip-empty">Aucun rappel pour ce jour.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
