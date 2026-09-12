import { useEffect, useMemo, useRef, useState } from "react";
import { isPassageRef } from "../youversion/usfm";
import { extractPassageRef, extractPassageRefs, sanitizePlanDays } from "../plan";
import {
  loadDayNote,
  pullDayNote,
  pushDayNote,
  saveDayNoteLocal,
} from "../planDayNote";
import { isPlanComplete, type PlanProgress } from "../planProgress";
import { buildDailyReadingReminder } from "../readingReminder";
import { scheduleReadingReminderTest } from "../readingReminderNotify";
import type { ReadingPlan } from "../types";
import { PlanDescription } from "./PlanDescription";

type TodayViewProps = {
  plan: ReadingPlan | null;
  progress?: PlanProgress | null;
  planJour?: number;
  /** Remet l’écran sur la timeline (ex. retour depuis Lecture du plan). */
  resumeSeq?: number;
  /** Ouvre la note du jour après la lecture (seq change à chaque fois). */
  dayNoteFocus?: { jour: number; seq: number } | null;
  onSelectGalerie?: () => void;
  onMarkRead?: (jour: number) => void;
  onOpenPassage?: (reference: string) => void;
  /** Démarre la lecture guidée du jour (versets → conclure). */
  onStartPlanReading?: (jour: number, passage: string) => void;
  /** Remet le plan à zéro et relance la lecture. */
  onRestartPlan?: () => void;
};

type PlanScreen = "timeline" | "intro" | "dayNote";

function introKey(planId: string) {
  return `biblos-plan-intro-seen:${planId}`;
}

function loadIntroSeen(planId: string): boolean {
  try {
    return localStorage.getItem(introKey(planId)) === "1";
  } catch {
    return false;
  }
}

function saveIntroSeen(planId: string, seen: boolean) {
  try {
    if (seen) localStorage.setItem(introKey(planId), "1");
    else localStorage.removeItem(introKey(planId));
  } catch {
    /* private mode */
  }
}

export function TodayView({
  plan,
  progress = null,
  planJour = 1,
  resumeSeq = 0,
  dayNoteFocus = null,
  onSelectGalerie,
  onMarkRead,
  onOpenPassage,
  onStartPlanReading,
  onRestartPlan,
}: TodayViewProps) {
  const [screen, setScreen] = useState<PlanScreen>("timeline");
  const [selectedJour, setSelectedJour] = useState(planJour);
  const [introSeen, setIntroSeen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const daysStripRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    if (!plan?.days?.length) return [];
    return sanitizePlanDays(plan.days);
  }, [plan]);

  const scheduleTotal = days.length;
  const scheduleDone = days.filter((day) => progress?.completedDays.includes(day.jour)).length;
  const planComplete = isPlanComplete({ days }, progress);
  const hasDescription = Boolean(plan?.description?.trim());

  useEffect(() => {
    if (!days.length) return;
    const preferred = days.find((day) => day.jour === planJour)?.jour ?? days[0]!.jour;
    setSelectedJour(preferred);
  }, [plan?.id, planJour, days]);

  useEffect(() => {
    if (!plan?.id) {
      setIntroSeen(false);
      return;
    }
    setIntroSeen(loadIntroSeen(plan.id));
    setScreen("timeline");
    setNoteMsg(null);
  }, [plan?.id]);

  useEffect(() => {
    if (!resumeSeq) return;
    if (dayNoteFocus?.seq) return;
    setScreen("timeline");
  }, [resumeSeq, dayNoteFocus?.seq]);

  useEffect(() => {
    if (!dayNoteFocus?.seq || !plan?.id) return;
    setSelectedJour(dayNoteFocus.jour);
    setScreen("dayNote");
  }, [dayNoteFocus?.seq, dayNoteFocus?.jour, plan?.id]);

  useEffect(() => {
    if (screen !== "dayNote" || !plan?.id) return;
    let cancelled = false;
    const local = loadDayNote(plan.id, selectedJour);
    setNoteText(local?.text ?? "");
    setNoteSaved(Boolean(local?.text?.trim() || local?.notionUrl));
    setNoteMsg(null);
    setNoteBusy(true);
    void pullDayNote(plan.id, plan.url, selectedJour).then((result) => {
      if (cancelled) return;
      setNoteText(result.text);
      setNoteSaved(Boolean(result.text.trim() || result.notionUrl));
      setNoteBusy(false);
      if (!result.ok && result.error) setNoteMsg(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, plan?.id, plan?.url, selectedJour]);

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
            Aucun plan chargé pour le moment.
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
  const dayNoteLocal = loadDayNote(plan.id, selectedJour);
  const dayNoteDone = Boolean(dayNoteLocal?.text?.trim() || dayNoteLocal?.notionUrl);
  const readingMinutes =
    passageRefs.length > 0
      ? (() => {
          const low = Math.max(5, passageRefs.length * 5);
          const high = Math.max(low + 5, passageRefs.length * 8);
          return `~${low}–${high} min`;
        })()
      : null;
  const progressPct =
    scheduleTotal > 0 ? Math.min(100, (scheduleDone / scheduleTotal) * 100) : 0;

  function openPassage() {
    if (!selectedDay || !firstPassage || !isPassageRef(firstPassage)) return;
    if (onStartPlanReading) {
      onStartPlanReading(selectedDay.jour, passage || firstPassage);
      return;
    }
    onOpenPassage?.(firstPassage);
  }

  function openDayNote() {
    setScreen("dayNote");
  }

  function markIntroSeen() {
    if (!plan) return;
    setIntroSeen(true);
    saveIntroSeen(plan.id, true);
  }

  function startReading() {
    if (!plan) return;
    if (planComplete) {
      onRestartPlan?.();
      setIntroSeen(false);
      saveIntroSeen(plan.id, false);
      const first = days[0];
      if (first) setSelectedJour(first.jour);
      if (hasDescription) {
        setScreen("intro");
        return;
      }
      return;
    }
    // Description une seule fois au démarrage du plan — pas chaque jour.
    if (hasDescription && !introSeen) {
      setScreen("intro");
      return;
    }
    openPassage();
  }

  async function saveDayNote(andClose: boolean) {
    if (!plan) return;
    setNoteBusy(true);
    setNoteMsg(null);
    saveDayNoteLocal(plan.id, selectedJour, { text: noteText });
    const result = await pushDayNote(plan.id, plan.url, selectedJour, noteText);
    setNoteBusy(false);
    if (!result.ok) {
      setNoteMsg("Enregistré sur cet appareil — sync plus tard");
      setNoteSaved(Boolean(noteText.trim()));
      if (andClose && !plan.url) setScreen("timeline");
      return;
    }
    setNoteSaved(true);
    setNoteMsg("Note enregistrée");
    if (andClose) setScreen("timeline");
  }

  async function testReadingReminder() {
    if (!plan) return;
    const reminder = buildDailyReadingReminder(plan, progress);
    if (!reminder) {
      setReminderMsg("Aucune lecture à rappeler pour ce plan.");
      return;
    }
    setReminderBusy(true);
    setReminderMsg(null);
    const result = await scheduleReadingReminderTest(reminder, 15);
    setReminderBusy(false);
    if (!result.ok) {
      setReminderMsg(result.error || "Échec du rappel de test");
      return;
    }
    setReminderMsg(
      result.mode === "native"
        ? `Rappel test dans ~15 s : ${reminder.passageLabel}`
        : `Rappel navigateur dans ~15 s : ${reminder.passageLabel}`,
    );
  }

  if (screen === "intro") {
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
          <p className="plan-yv-devo-eyebrow">Description · Au démarrage</p>
          <h2 className="plan-yv-devo-title">{planTitle}</h2>
        </header>

        <div className="plan-yv-devo-scroll">
          <PlanDescription description={plan.description} title="Description" showTitle={false} />
          {canOpenPassage && passageLabel ? (
            <aside className="plan-yv-devo-next" aria-label="Lecture du jour">
              <p className="plan-yv-devo-next-kicker">Ensuite</p>
              <p className="plan-yv-devo-next-ref">{passageLabel}</p>
            </aside>
          ) : null}
        </div>

        <footer className="plan-yv-devo-actions">
          <button
            type="button"
            className="plan-yv-devo-continue"
            style={{ gridColumn: "1 / -1" }}
            onClick={() => {
              markIntroSeen();
              if (canOpenPassage) {
                openPassage();
                return;
              }
              setScreen("timeline");
            }}
          >
            {canOpenPassage ? "Commencer la lecture" : "Retour au plan"}
          </button>
        </footer>
      </div>
    );
  }

  if (screen === "dayNote") {
    return (
      <div className="today-view panel-nota-content plan-yv plan-yv-devo plan-yv-day-note">
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
            Note du jour
            {selectedIndex > 0 ? (
              <>
                {" "}
                · Jour {selectedIndex} sur {scheduleTotal}
              </>
            ) : null}
          </p>
          <h2 className="plan-yv-devo-title">{planTitle}</h2>
          {passageLabel ? <p className="plan-yv-day-note-ref muted">{passageLabel}</p> : null}
        </header>

        <div className="plan-yv-devo-scroll">
          <label className="plan-yv-day-note-label" htmlFor="plan-day-note">
            Ta réflexion du jour
          </label>
          <textarea
            id="plan-day-note"
            className="plan-yv-day-note-input"
            value={noteText}
            onChange={(event) => {
              setNoteText(event.target.value);
              setNoteMsg(null);
            }}
            placeholder="Écris ta note du jour…"
            rows={10}
            disabled={noteBusy && !noteText}
          />
          {noteMsg ? <p className="plan-yv-day-note-msg muted">{noteMsg}</p> : null}
        </div>

        <footer className="plan-yv-devo-actions">
          <button
            type="button"
            className="plan-yv-devo-mark"
            disabled={noteBusy}
            onClick={() => setScreen("timeline")}
          >
            Passer
          </button>
          <button
            type="button"
            className="plan-yv-devo-continue"
            disabled={noteBusy}
            onClick={() => {
              void saveDayNote(true);
            }}
          >
            {noteBusy ? "Enregistrement…" : "Enregistrer"}
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
          <div className="plan-yv-timeline-meta">
            {selectedDay ? (
              <p className="plan-yv-progress">
                Jour {selectedIndex} sur {scheduleTotal}
                {selectedDay.jour === planJour ? (
                  <span className="plan-yv-progress-today"> · Aujourd’hui</span>
                ) : null}
              </p>
            ) : null}
          </div>

          {scheduleTotal > 0 ? (
            <div className="plan-yv-progress-row">
              <div
                className="plan-yv-timeline-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={scheduleTotal}
                aria-valuenow={scheduleDone}
                aria-label="Lectures terminées"
              >
                <span
                  className="plan-yv-timeline-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="plan-yv-timeline-count" aria-live="polite">
                {scheduleDone}/{scheduleTotal} lectures
              </p>
            </div>
          ) : null}

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
                    isCurrent && !read ? "is-today" : "",
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
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedDay ? (
        <section
          className={`plan-yv-hero${passageRead ? " is-done" : ""}`}
          aria-label="Lecture du jour"
        >
          <div className="plan-yv-hero-top">
            <p className="plan-yv-hero-eyebrow">
              Lecture du jour
              {selectedIndex > 0 ? ` · Jour ${selectedIndex}` : null}
            </p>
            {onMarkRead ? (
              <button
                type="button"
                className={`plan-yv-hero-mark${passageRead ? " is-done" : ""}`}
                onClick={() => onMarkRead(selectedDay.jour)}
                aria-pressed={passageRead}
                aria-label={passageRead ? "Démarquer comme lu" : "Marquer comme lu"}
              >
                {passageRead ? "✓ Lu" : "Marquer lu"}
              </button>
            ) : null}
          </div>
          <h3 className="plan-yv-hero-title">{passageLabel || "Passage du jour"}</h3>
          {readingMinutes ? (
            <p className="plan-yv-hero-meta">{readingMinutes}</p>
          ) : null}
          <button
            type="button"
            className="plan-yv-start"
            disabled={!planComplete && !canOpenPassage && !hasDescription}
            onClick={startReading}
          >
            {planComplete ? "Recommencer la lecture" : "Commencer la lecture"}
          </button>
        </section>
      ) : (
        <p className="muted plan-yv-empty">
          Aucun verset pour ce jour — le plan n’affiche que les références bibliques.
        </p>
      )}

      <nav className="plan-yv-secondary" aria-label="Actions secondaires">
        <button
          type="button"
          className={`plan-yv-secondary-row${dayNoteDone || noteSaved ? " is-done" : ""}`}
          onClick={openDayNote}
        >
          <span className="plan-yv-secondary-stack">
            <span className="plan-yv-secondary-label">Note du jour</span>
            <span className="plan-yv-secondary-meta">
              {dayNoteDone || noteSaved ? "Écrite" : "Optionnelle · après la lecture"}
            </span>
          </span>
          <span className="plan-yv-secondary-chevron" aria-hidden="true">
            ›
          </span>
        </button>

        <button
          type="button"
          className="plan-yv-secondary-row is-ghost"
          disabled={reminderBusy}
          onClick={() => {
            void testReadingReminder();
          }}
        >
          <span className="plan-yv-secondary-stack">
            <span className="plan-yv-secondary-label">
              {reminderBusy ? "Programmation…" : "Tester le rappel"}
            </span>
            <span className="plan-yv-secondary-meta">Notification dans ~15 s</span>
          </span>
          <span className="plan-yv-secondary-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </nav>
      {reminderMsg ? <p className="plan-yv-reminder-msg muted">{reminderMsg}</p> : null}
    </div>
  );
}
