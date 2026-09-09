import { useMemo, useState } from "react";
import {
  buildMonthGrid,
  formatDay,
  monthLabel,
  todayKey,
} from "../calendar";
import type { CalendarCardItem } from "../types";

type CalendarViewProps = {
  cards: CalendarCardItem[];
  cardCounts: ReadonlyMap<string, number>;
  onPickCard: (item: CalendarCardItem) => void;
  active?: boolean;
  splitLayout?: boolean;
};

const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function monthOf(day: string) {
  const date = new Date(`${day}T00:00:00`);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/**
 * Calendrier global — rappels de flashcards / thèmes divers.
 * Le cronograma du plan actif vit dans Galerie → Plan.
 */
export function CalendarView({
  cards,
  cardCounts,
  onPickCard,
}: CalendarViewProps) {
  const today = todayKey();
  const [selectedDay, setSelectedDay] = useState(today);
  const [cursor, setCursor] = useState(() => monthOf(today));
  const cells = buildMonthGrid(cursor.year, cursor.month);

  const dayCards = useMemo(
    () => cards.filter((item) => item.day === selectedDay),
    [cards, selectedDay],
  );

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
        <section className="calendar-panel" aria-label="Calendário global">
          <header className="calendar-month-head">
            <p className="session-kicker">Calendrier</p>
            <p className="calendar-month-hint muted">Rappels de tous les thèmes</p>
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
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectDay(day)}
                  aria-pressed={selected}
                  aria-label={`${formatDay(day)}${cardCount ? `, ${cardCount} lembrete${cardCount === 1 ? "" : "s"}` : ""}`}
                >
                  <span className="calendar-day-num">{Number(day.slice(8))}</span>
                  <span className="calendar-markers">
                    {cardCount ? (
                      <span className={`calendar-count${overdue ? " is-overdue" : ""}`}>
                        {cardCount > 9 ? "9+" : cardCount}
                      </span>
                    ) : null}
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

          {dayCards.length ? (
            <ol className="calendar-agenda-list">
              {dayCards.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="calendar-agenda-item"
                    onClick={() => onPickCard(item)}
                    aria-label={`Réviser la carte: ${item.title}`}
                  >
                    <span className="calendar-agenda-num">{index + 1}</span>
                    <span className="calendar-agenda-body">
                      <span className="calendar-agenda-title">{item.title}</span>
                    </span>
                    <span className="calendar-agenda-action" aria-hidden="true">
                      Rever
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted calendar-day-strip-empty">Aucun rappel pour ce jour.</p>
          )}
        </section>
      </div>
    </div>
  );
}
