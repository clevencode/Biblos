import { useEffect, useMemo, useState } from "react";
import { isPassageRef } from "../youversion/usfm";
import { extractPassageRef, sanitizePlanDays } from "../plan";
import { type PlanProgress } from "../planProgress";
import type { PlanDay, ReadingPlan } from "../types";
import { PlanDescription } from "./PlanDescription";

type TodayViewProps = {
  plan: ReadingPlan | null;
  progress?: PlanProgress | null;
  planJour?: number;
  onSelectGalerie?: () => void;
  onMarkRead?: (jour: number) => void;
  onOpenPassage?: (reference: string) => void;
};

type PlanScreen = "timeline" | "devotional";

/** Référence biblique du jour — ignore Objectif / textes longs. */
export function resolvePlanPassageRef(day: PlanDay): string | null {
  return extractPassageRef(day.texte) || extractPassageRef(day.defi);
}

function devotionalKey(planId: string) {
  return `biblos-devotional-done:${planId}`;
}

function loadDevotionalDone(planId: string): boolean {
  try {
    return localStorage.getItem(devotionalKey(planId)) === "1";
  } catch {
    return false;
  }
}

function saveDevotionalDone(planId: string, done: boolean) {
  try {
    if (done) localStorage.setItem(devotionalKey(planId), "1");
    else localStorage.removeItem(devotionalKey(planId));
  } catch {
    /* private mode */
  }
}

export function TodayView({
  plan,
  progress = null,
  planJour = 1,
  onSelectGalerie,
  onMarkRead,
  onOpenPassage,
}: TodayViewProps) {
  const [screen, setScreen] = useState<PlanScreen>("timeline");
  const [selectedJour, setSelectedJour] = useState(planJour);
  const [devotionalDone, setDevotionalDone] = useState(false);

  const days = useMemo(() => {
    if (!plan?.days?.length) return [];
    return sanitizePlanDays(plan.days);
  }, [plan]);

  const hasDescription = Boolean(plan?.description?.trim());
  const scheduleTotal = days.length;
  const scheduleDone = days.filter((day) => progress?.completedDays.includes(day.jour)).length;

  useEffect(() => {
    if (!days.length) return;
    const preferred = days.find((day) => day.jour === planJour)?.jour ?? days[0]!.jour;
    setSelectedJour(preferred);
  }, [plan?.id, planJour, days]);

  useEffect(() => {
    if (!plan?.id) {
      setDevotionalDone(false);
      return;
    }
    setDevotionalDone(loadDevotionalDone(plan.id));
    setScreen("timeline");
  }, [plan?.id]);

  if (!plan) {
    return (
      <div className="today-view panel-nota-content">
        <header className="page-session-head">
          <p className="session-kicker">Thème</p>
          <nav className="crumb page-crumb" aria-label="Local dans la galerie">
            <button type="button" onClick={() => onSelectGalerie?.()}>
              Galerie
            </button>
          </nav>
          <h2 className="page-title">Aucun plan</h2>
          <p className="page-session-meta muted">
            Seed vide (MVP) — synchronise Notion pour charger un plan.
          </p>
        </header>
      </div>
    );
  }

  const planTitle = plan.theme?.trim() || plan.nome;
  const selectedDay = days.find((day) => day.jour === selectedJour) ?? days[0] ?? null;
  const passage = selectedDay?.texte ?? "";
  const passageRead = selectedDay
    ? (progress?.completedDays.includes(selectedDay.jour) ?? false)
    : false;
  const canOpenPassage = Boolean(passage && onOpenPassage && isPassageRef(passage));
  const selectedIndex = selectedDay ? days.findIndex((day) => day.jour === selectedDay.jour) + 1 : 0;

  function openDevotional() {
    setScreen("devotional");
  }

  function toggleDevotionalDone() {
    if (!plan) return;
    const next = !devotionalDone;
    setDevotionalDone(next);
    saveDevotionalDone(plan.id, next);
  }

  function startReading() {
    if (hasDescription && !devotionalDone) {
      openDevotional();
      return;
    }
    if (canOpenPassage) onOpenPassage?.(passage);
  }

  if (screen === "devotional" && hasDescription) {
    return (
      <div className="today-view panel-nota-content plan-yv">
        <header className="page-session-head">
          <p className="session-kicker">Devotional</p>
          <nav className="crumb page-crumb" aria-label="Navigation du plan">
            <button type="button" onClick={() => setScreen("timeline")}>
              Plan
            </button>
            <span aria-hidden="true">/</span>
            <span className="page-crumb-current">Devotional</span>
          </nav>
          <h2 className="page-title">{planTitle}</h2>
        </header>
        <PlanDescription description={plan.description} title="Devotional" />
        <div className="plan-yv-devotional-actions">
          <button
            type="button"
            className={`flash-btn calendar-plan-lu${devotionalDone ? " is-done" : ""}`}
            onClick={toggleDevotionalDone}
            aria-pressed={devotionalDone}
          >
            <span className="calendar-plan-lu-check" aria-hidden="true">
              {devotionalDone ? "✓" : "○"}
            </span>
            {devotionalDone ? "Marqué comme lu" : "Marquer comme lu"}
          </button>
          <button type="button" className="flash-btn flash-btn--primary" onClick={() => setScreen("timeline")}>
            Retour au plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="today-view panel-nota-content plan-yv">
      <header className="page-session-head">
        <p className="session-kicker">Thème</p>
        <nav className="crumb page-crumb" aria-label="Local dans la galerie">
          <button type="button" onClick={() => onSelectGalerie?.()}>
            Galerie
          </button>
          <span aria-hidden="true">/</span>
          <span className="page-crumb-current">Plan</span>
        </nav>
        <h2 className="page-title">{planTitle}</h2>
        <div className="page-session-meta theme-head-meta">
          {scheduleTotal ? (
            <span className="page-session-status">
              {scheduleDone}/{scheduleTotal} jours
            </span>
          ) : null}
          {plan.url ? (
            <a className="page-open" href={plan.url} target="_blank" rel="noreferrer">
              Notion
            </a>
          ) : null}
        </div>
      </header>

      {days.length ? (
        <div className="plan-yv-days" role="listbox" aria-label="Jours du plan">
          {days.map((day) => {
            const selected = day.jour === selectedDay?.jour;
            const read = progress?.completedDays.includes(day.jour) ?? false;
            return (
              <button
                key={day.jour}
                type="button"
                role="option"
                aria-selected={selected}
                className={[
                  "plan-yv-day",
                  selected ? "is-selected" : "",
                  read ? "is-read" : "",
                  day.jour === planJour ? "is-today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelectedJour(day.jour)}
              >
                <span className="plan-yv-day-num">{day.jour}</span>
                <span className="plan-yv-day-label">Jour</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedDay ? (
        <p className="plan-yv-progress">
          Jour {selectedIndex} sur {scheduleTotal}
        </p>
      ) : null}

      <section className="plan-yv-tasks" aria-label="Lecture du jour">
        <ul className="plan-yv-task-list">
          {hasDescription ? (
            <li className="plan-yv-task-row">
              <button
                type="button"
                className={`plan-yv-task-check-btn${devotionalDone ? " is-done" : ""}`}
                onClick={toggleDevotionalDone}
                aria-pressed={devotionalDone}
                aria-label={devotionalDone ? "Démarquer le Devotional" : "Marquer le Devotional"}
              >
                {devotionalDone ? "✓" : "○"}
              </button>
              <button
                type="button"
                className={`plan-yv-task plan-yv-task--grow${devotionalDone ? " is-done" : ""}`}
                onClick={openDevotional}
              >
                <span className="plan-yv-task-label">Devotional</span>
                <span className="plan-yv-task-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ) : null}
          {selectedDay ? (
            <li className="plan-yv-task-row">
              {onMarkRead ? (
                <button
                  type="button"
                  className={`plan-yv-task-check-btn${passageRead ? " is-done" : ""}`}
                  onClick={() => onMarkRead(selectedDay.jour)}
                  aria-pressed={passageRead}
                  aria-label={passageRead ? "Démarquer comme lu" : "Marquer comme lu"}
                >
                  {passageRead ? "✓" : "○"}
                </button>
              ) : (
                <span className={`plan-yv-task-check${passageRead ? " is-done" : ""}`} aria-hidden="true">
                  {passageRead ? "✓" : "○"}
                </span>
              )}
              <button
                type="button"
                className={`plan-yv-task plan-yv-task--grow${passageRead ? " is-done" : ""}`}
                disabled={!canOpenPassage}
                onClick={() => {
                  if (canOpenPassage) onOpenPassage?.(passage);
                }}
              >
                <span className="plan-yv-task-label">{passage}</span>
                <span className="plan-yv-task-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ) : (
            <li>
              <p className="muted plan-yv-empty">
                Aucun verset pour ce jour — le plan n’affiche que les références bibliques.
              </p>
            </li>
          )}
        </ul>
      </section>

      {hasDescription || canOpenPassage ? (
        <button type="button" className="plan-yv-start" onClick={startReading}>
          Commencer la lecture
        </button>
      ) : null}
    </div>
  );
}
