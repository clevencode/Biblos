import { useEffect, useMemo, useRef, useState } from "react";
import { isPassageRef } from "../youversion/usfm";
import { extractPassageRef, extractPassageRefs, sanitizePlanDays } from "../plan";
import { isPlanComplete, type PlanProgress } from "../planProgress";
import type { ReadingPlan } from "../types";
import { PlanDescription } from "./PlanDescription";

type TodayViewProps = {
  plan: ReadingPlan | null;
  progress?: PlanProgress | null;
  planJour?: number;
  /** Remet l’écran sur la timeline (ex. retour depuis Lecture du plan). */
  resumeSeq?: number;
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
  resumeSeq = 0,
  onSelectGalerie,
  onMarkRead,
  onOpenPassage,
  onStartPlanReading,
  onRestartPlan,
}: TodayViewProps) {
  const [screen, setScreen] = useState<PlanScreen>("timeline");
  const [selectedJour, setSelectedJour] = useState(planJour);
  const [devotionalDone, setDevotionalDone] = useState(false);
  const daysStripRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!resumeSeq) return;
    setScreen("timeline");
  }, [resumeSeq]);

  useEffect(() => {
    if (screen !== "timeline") return;
    const root = daysStripRef.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>(".plan-yv-day.is-selected");
    selected?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [screen, selectedJour, days.length]);

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
  const passageRefs = extractPassageRefs(passage);
  const passageLabel = passageRefs.length > 1 ? passageRefs.join(" · ") : (passageRefs[0] ?? passage);
  const firstPassage = passageRefs[0] ?? extractPassageRef(passage);
  const passageRead = selectedDay
    ? (progress?.completedDays.includes(selectedDay.jour) ?? false)
    : false;
  const canOpenPassage = Boolean(
    firstPassage && (onStartPlanReading || onOpenPassage) && isPassageRef(firstPassage),
  );
  const selectedIndex = selectedDay ? days.findIndex((day) => day.jour === selectedDay.jour) + 1 : 0;

  function openPassage() {
    if (!selectedDay || !firstPassage || !isPassageRef(firstPassage)) return;
    if (onStartPlanReading) {
      onStartPlanReading(selectedDay.jour, passage || firstPassage);
      return;
    }
    onOpenPassage?.(firstPassage);
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
    const continueLabel = canOpenPassage ? "Continuer la lecture" : "Retour au plan";

    return (
      <div className="today-view panel-nota-content plan-yv plan-yv-devo">
        <header className="plan-yv-devo-head">
          <button
            type="button"
            className="flash-list-back"
            onClick={() => setScreen("timeline")}
            aria-label="Retour au plan"
          >
            ← Retour
          </button>
          <p className="plan-yv-devo-eyebrow">
            Devotional
            {selectedIndex > 0 ? (
              <>
                {" "}
                · Jour {selectedIndex} sur {scheduleTotal}
              </>
            ) : null}
          </p>
          <h2 className="plan-yv-devo-title">{planTitle}</h2>
        </header>

        <div className="plan-yv-devo-scroll">
          <PlanDescription description={plan.description} title="Devotional" showTitle={false} />
          {canOpenPassage && passageLabel ? (
            <aside className="plan-yv-devo-next" aria-label="Lecture du jour">
              <p className="plan-yv-devo-next-kicker">À lire ensuite</p>
              <p className="plan-yv-devo-next-ref">{passageLabel}</p>
            </aside>
          ) : null}
        </div>

        <footer className="plan-yv-devo-actions">
          <button
            type="button"
            className={`plan-yv-devo-mark${devotionalDone ? " is-done" : ""}`}
            onClick={toggleDevotionalDone}
            aria-pressed={devotionalDone}
          >
            <span className="plan-yv-devo-mark-check" aria-hidden="true">
              {devotionalDone ? "✓" : "○"}
            </span>
            {devotionalDone ? "Marqué comme lu" : "Marquer comme lu"}
          </button>
          <button
            type="button"
            className="plan-yv-devo-continue"
            onClick={() => {
              if (!devotionalDone) {
                setDevotionalDone(true);
                saveDevotionalDone(plan.id, true);
              }
              if (canOpenPassage && selectedDay && firstPassage) {
                if (onStartPlanReading) {
                  onStartPlanReading(selectedDay.jour, passage || firstPassage);
                } else {
                  onOpenPassage?.(firstPassage);
                }
                return;
              }
              setScreen("timeline");
            }}
          >
            {continueLabel}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="today-view panel-nota-content plan-yv">
      <header className="page-session-head plan-yv-head">
        <div className="plan-yv-head-row">
          <button
            type="button"
            className="flash-list-back"
            onClick={() => onSelectGalerie?.()}
            aria-label="Retour à la galerie"
          >
            ←
          </button>
          <h2 className="page-title">{planTitle}</h2>
        </div>
      </header>

      {days.length ? (
        <section className="plan-yv-timeline" aria-label="Progression du plan">
          <div
            ref={daysStripRef}
            className={`plan-yv-days${days.length <= 7 ? " is-fit" : ""}`}
            role="listbox"
            aria-label="Jours du plan"
          >
            {days.map((day) => {
              const selected = day.jour === selectedDay?.jour;
              const read = progress?.completedDays.includes(day.jour) ?? false;
              const isCurrent = day.jour === planJour;
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
                    isCurrent ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedJour(day.jour)}
                  aria-label={[
                    `Jour ${day.jour}`,
                    selected ? "sélectionné" : null,
                    isCurrent ? "jour actuel" : null,
                    read ? "terminé" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                >
                  {read ? (
                    <span className="plan-yv-day-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                  <span className="plan-yv-day-num">{day.jour}</span>
                  <span className="plan-yv-day-label">Jour</span>
                  {isCurrent ? <span className="plan-yv-day-dot" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>

          <div className="plan-yv-timeline-meta">
            {selectedDay ? (
              <p className="plan-yv-progress">
                Jour {selectedIndex} sur {scheduleTotal}
                {selectedDay.jour === planJour ? (
                  <span className="plan-yv-progress-today"> · Aujourd’hui</span>
                ) : null}
              </p>
            ) : null}
            {scheduleTotal > 0 ? (
              <p className="plan-yv-timeline-count" aria-live="polite">
                {scheduleDone}/{scheduleTotal} lus
              </p>
            ) : null}
          </div>

          {scheduleTotal > 0 ? (
            <div
              className="plan-yv-timeline-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={scheduleTotal}
              aria-valuenow={scheduleDone}
              aria-label="Jours terminés"
            >
              <span
                className="plan-yv-timeline-fill"
                style={{
                  width: `${Math.min(100, (scheduleDone / scheduleTotal) * 100)}%`,
                }}
              />
            </div>
          ) : null}
        </section>
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
              <span className="plan-yv-task-stack">
                <span className="plan-yv-task-label">Devotional</span>
                <span className="plan-yv-task-meta">
                  {devotionalDone ? "Lu · Méditation" : "Méditation du jour"}
                </span>
              </span>
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
                <span className="plan-yv-task-label">{passageLabel}</span>
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
