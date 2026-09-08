import { useEffect, useMemo, useState } from "react";
import {
  buildMonthGrid,
  formatDay,
  monthLabel,
  relativeDayLabel,
  shiftDay,
  todayKey,
  weekdayLabel,
} from "../calendar";
import { isPassageRef } from "../youversion/usfm";
import {
  dateForPlanJour,
  dayEntry,
  planJourForDate,
  progressCounts,
  type PlanProgress,
} from "../planProgress";
import type { CalendarCardItem, ReadingPlan } from "../types";
import { isPassageReminder } from "../passageReminder";

type CalendarViewProps = {
  cards: CalendarCardItem[];
  cardCounts: ReadonlyMap<string, number>;
  onPickCard: (item: CalendarCardItem) => void;
  /** Painel da agenda activo — ao sair, volta ao mês. */
  active?: boolean;
  /** Expanded (≥1280): mês | agenda. Medium/compact: mês↔dia. */
  splitLayout?: boolean;
  plan?: ReadingPlan | null;
  progress?: PlanProgress | null;
  planJour?: number;
  onMarkRead?: (jour: number) => void;
  onOpenPassage?: (reference: string) => void;
};

const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function monthOf(day: string) {
  const date = new Date(`${day}T00:00:00`);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function dayTitle(day: string, today: string): string {
  return relativeDayLabel(day, today) ?? weekdayLabel(day);
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

type DayAgendaProps = {
  selectedDay: string;
  today: string;
  dayCards: CalendarCardItem[];
  onPickCard: (item: CalendarCardItem) => void;
  onMoveDay: (delta: number) => void;
  onBackToMonth?: () => void;
  showBack?: boolean;
  plan?: ReadingPlan | null;
  progress?: PlanProgress | null;
  planJour?: number;
  onMarkRead?: (jour: number) => void;
  onOpenPassage?: (reference: string) => void;
};

function DayAgenda({
  selectedDay,
  today,
  dayCards,
  onPickCard,
  onMoveDay,
  onBackToMonth,
  showBack = false,
  plan,
  progress,
  planJour = 1,
  onMarkRead,
  onOpenPassage,
}: DayAgendaProps) {
  const title = dayTitle(selectedDay, today);
  const absolute = formatDay(selectedDay);
  const countLabel =
    dayCards.length === 0
      ? "Aucun rappel"
      : dayCards.length === 1
        ? "1 rappel · toucher pour réviser"
        : `${dayCards.length} rappels · toucher pour réviser`;

  const { done, total } = progressCounts(plan, progress);
  const selectedPlanJour =
    plan && progress
      ? planJourForDate(progress.startDate, selectedDay, plan.days.length)
      : null;
  const planDay = plan && selectedPlanJour ? dayEntry(plan, selectedPlanJour) : null;
  const isRead = selectedPlanJour
    ? (progress?.completedDays.includes(selectedPlanJour) ?? false)
    : false;
  const passageClickable = Boolean(
    onOpenPassage && planDay?.texte && isPassageRef(planDay.texte),
  );

  return (
    <aside className="calendar-agenda" aria-label={`Rappels du ${absolute}`}>
      <header className="calendar-agenda-head">
        <p className="session-kicker">Rappels</p>
        <PlanProgressMeta jour={planJour} done={done} total={total} />
        <div className="calendar-agenda-day-nav">
          <button type="button" className="flash-btn" aria-label="Dia anterior" onClick={() => onMoveDay(-1)}>
            ←
          </button>
          <div className="calendar-agenda-day-copy">
            <h2>{title}</h2>
            <p>
              <time dateTime={selectedDay}>{absolute}</time>
              <span aria-hidden="true"> · </span>
              {countLabel}
            </p>
          </div>
          <button type="button" className="flash-btn" aria-label="Dia seguinte" onClick={() => onMoveDay(1)}>
            →
          </button>
        </div>
      </header>
      <div className="calendar-agenda-scroller">
        {planDay ? (
          <article className="calendar-plan-day">
            <h3 className="calendar-plan-day-title">Jour {selectedPlanJour} du plan</h3>
            {planDay.texte ? (
              <section className="calendar-plan-section">
                <h4 className="calendar-plan-section-label">Texte</h4>
                {passageClickable ? (
                  <button
                    type="button"
                    className="calendar-plan-passage"
                    onClick={() => onOpenPassage?.(planDay.texte)}
                  >
                    {planDay.texte}
                  </button>
                ) : (
                  <p className="calendar-plan-section-body">{planDay.texte}</p>
                )}
              </section>
            ) : null}
            {planDay.defi ? (
              <section className="calendar-plan-section">
                <h4 className="calendar-plan-section-label">Défi</h4>
                <p className="calendar-plan-section-body calendar-plan-defi">{planDay.defi}</p>
              </section>
            ) : null}
            {onMarkRead && selectedPlanJour ? (
              <button
                type="button"
                className={`flash-btn calendar-plan-mark${isRead ? " is-done" : ""}`}
                disabled={isRead}
                onClick={() => onMarkRead(selectedPlanJour)}
              >
                {isRead ? "Lu" : "Marquer comme lu"}
              </button>
            ) : null}
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
          <div className="calendar-agenda-empty">
            <p className="calendar-agenda-empty-title">Sem lembretes</p>
            <p className="muted">Não há cartões agendados para este dia.</p>
            {onBackToMonth && !showBack ? (
              <button type="button" className="calendar-agenda-empty-action" onClick={onBackToMonth}>
                Escolher outro dia
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {showBack && onBackToMonth ? (
        <button type="button" className="flash-list-back flash-review-back" onClick={onBackToMonth}>
          ← Retour
        </button>
      ) : null}
    </aside>
  );
}

type MonthPanelProps = {
  today: string;
  cursor: { year: number; month: number };
  cells: (string | null)[];
  cardCounts: ReadonlyMap<string, number>;
  selectedDay: string;
  onShift: (delta: number) => void;
  onSelectDay: (day: string) => void;
  onToday: () => void;
  hint?: string;
  planJour?: number;
  done?: number;
  total?: number;
  planDayKeys?: ReadonlySet<string>;
};

function MonthPanel({
  today,
  cursor,
  cells,
  cardCounts,
  selectedDay,
  onShift,
  onSelectDay,
  onToday,
  hint = "Escolhe um dia para ver os lembretes",
  planJour = 0,
  done = 0,
  total = 0,
  planDayKeys,
}: MonthPanelProps) {
  return (
    <section className="calendar-panel" aria-label="Calendário mensal">
      <header className="calendar-month-head">
        <p className="session-kicker">Agenda</p>
        <PlanProgressMeta jour={planJour || 1} done={done} total={total} />
        <div className="calendar-nav">
          <button type="button" className="flash-btn" onClick={() => onShift(-1)} aria-label="Mois précédent">
            ←
          </button>
          <strong>{monthLabel(cursor.year, cursor.month)}</strong>
          <button type="button" className="flash-btn" onClick={() => onShift(1)} aria-label="Mois suivant">
            →
          </button>
        </div>
        <p className="calendar-month-hint muted">{hint}</p>
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
          const isPlanDay = planDayKeys?.has(day) ?? false;
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
              onClick={() => onSelectDay(day)}
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
      <button type="button" className="calendar-today" onClick={onToday}>
        Voir les rappels d’aujourd’hui
      </button>
    </section>
  );
}

export function CalendarView({
  cards,
  cardCounts,
  onPickCard,
  active = true,
  splitLayout = false,
  plan = null,
  progress = null,
  planJour = 1,
  onMarkRead,
  onOpenPassage,
}: CalendarViewProps) {
  const today = todayKey();
  const [selectedDay, setSelectedDay] = useState(today);
  const [pane, setPane] = useState<"month" | "day">("month");
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

  useEffect(() => {
    if (!active) setPane("month");
  }, [active]);

  function shift(delta: number) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function selectDay(day: string) {
    setSelectedDay(day);
    setCursor(monthOf(day));
    if (!splitLayout) setPane("day");
  }

  function moveDay(delta: number) {
    const next = shiftDay(selectedDay, delta);
    setSelectedDay(next);
    setCursor(monthOf(next));
  }

  function goToday() {
    setCursor(monthOf(today));
    selectDay(today);
  }

  const agendaProps = {
    selectedDay,
    today,
    dayCards,
    onPickCard,
    onMoveDay: moveDay,
    plan,
    progress,
    planJour,
    onMarkRead,
    onOpenPassage,
  };

  if (splitLayout) {
    return (
      <div className="calendar-view calendar-view--split">
        <div className="calendar-split-master">
          <MonthPanel
            today={today}
            cursor={cursor}
            cells={cells}
            cardCounts={cardCounts}
            selectedDay={selectedDay}
            onShift={shift}
            onSelectDay={selectDay}
            onToday={goToday}
            hint="Escolhe um dia para ver os lembretes ao lado"
            planJour={planJour}
            done={done}
            total={total}
            planDayKeys={planDayKeys}
          />
        </div>
        <div className="calendar-split-detail">
          <DayAgenda {...agendaProps} />
        </div>
      </div>
    );
  }

  if (pane === "day") {
    return (
      <div className="calendar-view calendar-view--day">
        <DayAgenda {...agendaProps} onBackToMonth={() => setPane("month")} showBack />
      </div>
    );
  }

  return (
    <div className="calendar-view calendar-view--month">
      <div className="calendar-body">
        <MonthPanel
          today={today}
          cursor={cursor}
          cells={cells}
          cardCounts={cardCounts}
          selectedDay={selectedDay}
          onShift={shift}
          onSelectDay={selectDay}
          onToday={goToday}
          planJour={planJour}
          done={done}
          total={total}
          planDayKeys={planDayKeys}
        />
      </div>
    </div>
  );
}
