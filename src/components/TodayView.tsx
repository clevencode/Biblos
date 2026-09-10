import { useEffect, useMemo, useState } from "react";
import { isPassageRef } from "../youversion/usfm";
import { sanitizePlanDays } from "../plan";
import { isPlanComplete, type PlanProgress } from "../planProgress";
import type { ReadingPlan } from "../types";
import { PlanDescription } from "./PlanDescription";

type TodayViewProps = {
  plan: ReadingPlan | null;
  progress?: PlanProgress | null;
  planJour?: number;
  onSelectGalerie?: () => void;
  onMarkRead?: (jour: number) => void;
  onOpenPassage?: (reference: string) => void;
  /** Démarre la lecture guidée du jour (versets → conclure). */
  onStartPlanReading?: (jour: number, passage: string) => void;
  /** Remet le plan à zéro et relance la lecture. */
  onRestartPlan?: () => void;
};

type PlanScreen = "timeline" | "devotional";

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
  onStartPlanReading,
  onRestartPlan,
}: TodayViewProps) {
  const [screen, setScreen] = useState<PlanScreen>("timeline");
  const [selectedJour, setSelectedJour] = useState(planJour);
  const [devotionalDone, setDevotionalDone] = useState(false);

  const days = useMemo(() => {
    if (!plan?.days?.length) return [];
    return sanitizePlanDays(plan.days);
  }, [plan]);

  const scheduleTotal = days.length;
  const scheduleDone = days.filter((day) => progress?.completedDays.includes(day.jour)).length;
  const planComplete = isPlanComplete({ days }, progress);

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
          <button
            type="button"
            className="flash-list-back"
            onClick={() => onSelectGalerie?.()}
            aria-label="Retour à la galerie"
          >
            ← Retour
          </button>
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
  const canOpenPassage = Boolean(
    passage && (onStartPlanReading || onOpenPassage) && isPassageRef(passage),
  );
  const selectedIndex = selectedDay ? days.findIndex((day) => day.jour === selectedDay.jour) + 1 : 0;

  function openPassage() {
    if (!selectedDay || !passage || !isPassageRef(passage)) return;
    if (onStartPlanReading) {
      onStartPlanReading(selectedDay.jour, passage);
      return;
    }
    onOpenPassage?.(passage);
  }

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
    if (planComplete) {
      onRestartPlan?.();
      setDevotionalDone(false);
      if (plan) saveDevotionalDone(plan.id, false);
      const first = days[0];
      if (first) setSelectedJour(first.jour);
      return;
    }
    if (!devotionalDone) {
      openDevotional();
      return;
    }
    openPassage();
  }

  if (screen === "devotional") {
    return (
      <div className="today-view panel-nota-content plan-yv">
        <header className="page-session-head">
          <button
            type="button"
            className="flash-list-back"
            onClick={() => setScreen("timeline")}
            aria-label="Retour au plan"
          >
            ← Retour
          </button>
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
          <button
            type="button"
            className="flash-btn flash-btn--primary"
            onClick={() => {
              if (!devotionalDone) {
                setDevotionalDone(true);
                saveDevotionalDone(plan.id, true);
              }
              setScreen("timeline");
              if (selectedDay && passage && isPassageRef(passage)) {
                if (onStartPlanReading) onStartPlanReading(selectedDay.jour, passage);
                else onOpenPassage?.(passage);
              }
            }}
          >
            Continuer la lecture
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="today-view panel-nota-content plan-yv">
      <header className="page-session-head">
        <button
          type="button"
          className="flash-list-back"
          onClick={() => onSelectGalerie?.()}
          aria-label="Retour à la galerie"
        >
          ← Retour
        </button>
        <h2 className="page-title">{planTitle}</h2>
        <div className="page-session-meta theme-head-meta">
          {scheduleTotal ? (
            <span className="page-session-status">
              {planComplete
                ? "Plan terminé"
                : `${scheduleDone}/${scheduleTotal} jours`}
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
                aria-label={
                  read
                    ? `Jour ${day.jour}, terminé`
                    : `Jour ${day.jour}${selected ? ", sélectionné" : ""}`
                }
              >
                {read ? (
                  <span className="plan-yv-day-check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
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
                  if (canOpenPassage) openPassage();
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

      <button type="button" className="plan-yv-start" onClick={startReading}>
        {planComplete ? "Recommencer la lecture" : "Commencer la lecture"}
      </button>
    </div>
  );
}
