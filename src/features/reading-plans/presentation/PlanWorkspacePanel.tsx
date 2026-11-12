import { useEffect, useMemo, useRef, useState } from "react";
import { BibleShareSheet } from "../../../components/BibleShareSheet";
import { YvIcon } from "../../../components/YvIcon";
import { isPassageRef } from "../../../youversion/usfm";
import {
  calendarPlanJour,
  formatPlanTileDate,
  latestPlanJour,
  planJourDate,
} from "../domain/planCalendar";
import { loadDayNote } from "../domain/planDayNote";
import { PlanPersonalNotePanel } from "./PlanStageNotePanel";
import {
  extractPassageRef,
  extractPassageRefs,
} from "../domain/planPassageRefs";
import {
  formatReadingTimeLabel,
  passageHasDefinedChapter,
} from "../domain/planReadingEstimates";
import {
  isJourComplete,
  isPlanComplete,
  loadPlanProgress,
  markJourComplete,
  progressCounts,
  resetPlanProgress,
  resumeStepIndex,
  type PlanProgress,
} from "../domain/planProgress";
import {
  planDaysFromReadingPlan,
  stageForJour,
  stagesFromReadingPlan,
} from "../domain/planUiStages";
import type { ReadingPlan } from "../domain/types";
import { PlanDescription } from "./PlanDescription";

export type PlanFlowReturn = "timeline" | "dayNote" | "intro";

type PlanWorkspacePanelProps = {
  plan: ReadingPlan;
  progress?: PlanProgress | null;
  focusJour?: number;
  resumeSeq?: number;
  dayNoteFocus?: { jour: number; seq: number } | null;
  introFocus?: { seq: number } | null;
  onClearDayNoteFocus?: () => void;
  onClearIntroFocus?: () => void;
  onLeave?: () => void;
  onMarkRead?: (jour: number) => void;
  onStartPlanReading?: (
    jour: number,
    passage: string,
    opts?: { returnTo?: PlanFlowReturn },
  ) => void;
  onRestartPlan?: () => void;
};

type PlanScreen = "timeline" | "intro" | "dayNote";

function PassageRefsList({
  refs,
  fallback,
  className,
  done = false,
  onToggleDone,
  onOpenRef,
}: {
  refs: string[];
  fallback?: string;
  className?: string;
  done?: boolean;
  onToggleDone?: () => void;
  onOpenRef?: (ref: string) => void;
}) {
  const items = refs.length ? refs : fallback ? [fallback] : [];
  if (!items.length) return null;

  if (!onToggleDone && !onOpenRef && items.length === 1) {
    return <p className={className}>{items[0]}</p>;
  }

  return (
    <ul
      className={`plan-yv-ref-list${className ? ` ${className}` : ""}`}
      aria-label={onToggleDone || onOpenRef ? "Passages du jour" : undefined}
    >
      {items.map((ref, index) => (
        <li
          key={ref}
          className={onToggleDone || onOpenRef ? "plan-yv-ref-row" : undefined}
        >
          {onOpenRef ? (
            <button
              type="button"
              className="plan-yv-ref-text plan-yv-ref-link"
              onClick={() => onOpenRef(ref)}
            >
              {ref}
            </button>
          ) : (
            <span className="plan-yv-ref-text">{ref}</span>
          )}
          {onToggleDone && index === 0 ? (
            <button
              type="button"
              className={`plan-yv-ref-mark${done ? " is-done" : ""}`}
              onClick={onToggleDone}
              aria-pressed={done}
              aria-label={done ? "Démarquer le jour comme lu" : "Marquer le jour comme lu"}
            >
              {done ? <span aria-hidden="true">✓</span> : null}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

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

export function PlanWorkspacePanel({
  plan,
  progress: progressProp = null,
  focusJour,
  resumeSeq = 0,
  dayNoteFocus = null,
  introFocus = null,
  onClearDayNoteFocus,
  onClearIntroFocus,
  onLeave,
  onMarkRead,
  onStartPlanReading,
  onRestartPlan,
}: PlanWorkspacePanelProps) {
  const [progressTick, setProgressTick] = useState(0);
  useEffect(() => {
    const onChange = () => setProgressTick((n) => n + 1);
    window.addEventListener("biblos-plan-progress", onChange);
    return () => window.removeEventListener("biblos-plan-progress", onChange);
  }, []);

  const progress = useMemo(
    () => progressProp ?? loadPlanProgress(plan.id),
    [plan.id, progressProp, progressTick],
  );
  const planJour = calendarPlanJour(plan, progress);
  const resumeJour = useMemo(() => {
    const steps = planDaysFromReadingPlan(plan);
    const idx = resumeStepIndex(plan);
    return steps[idx]?.jour ?? latestPlanJour(plan, progress);
  }, [plan, progress]);
  const jumpJour = focusJour ?? resumeJour;

  const [screen, setScreen] = useState<PlanScreen>("timeline");
  const [selectedJour, setSelectedJour] = useState(jumpJour);
  const [introSeen, setIntroSeen] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const daysStripRef = useRef<HTMLDivElement>(null);
  const stagesStripRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => planDaysFromReadingPlan(plan), [plan]);
  const stages = useMemo(() => stagesFromReadingPlan(plan), [plan]);
  const scheduleTotal = days.length;
  const planComplete = isPlanComplete(plan, progress);
  const hasDescription = Boolean(plan.description?.trim());
  const hasStages = stages.length > 0;
  const selectedStage =
    stageForJour(stages, selectedJour) ?? (hasStages ? stages[0]! : undefined);
  const stageDays = useMemo(() => {
    if (!hasStages) return days;
    if (!selectedStage) return [];
    return days.filter(
      (day) => day.jour >= selectedStage.fromJour && day.jour <= selectedStage.toJour,
    );
  }, [days, hasStages, selectedStage]);
  const stageDayTotal = stageDays.length;
  const stageDayIndex = hasStages
    ? Math.max(0, stageDays.findIndex((day) => day.jour === selectedJour) + 1)
    : 0;

  useEffect(() => {
    if (!days.length) return;
    const preferred =
      days.find((day) => day.jour === jumpJour)?.jour ?? days[0]!.jour;
    setSelectedJour(preferred);
  }, [plan.id, jumpJour, days]);

  useEffect(() => {
    setIntroSeen(loadIntroSeen(plan.id));
    setScreen("timeline");
  }, [plan.id]);

  useEffect(() => {
    if (!resumeSeq) return;
    if (dayNoteFocus?.seq || introFocus?.seq) return;
    setScreen("timeline");
    if (!days.length) return;
    const preferred =
      days.find((day) => day.jour === jumpJour)?.jour ?? days[0]!.jour;
    setSelectedJour(preferred);
  }, [resumeSeq, dayNoteFocus?.seq, introFocus?.seq, jumpJour, days]);

  useEffect(() => {
    if (!dayNoteFocus?.seq) return;
    const day = days.find((d) => d.jour === dayNoteFocus.jour);
    if (!passageHasDefinedChapter(day?.passage)) {
      onClearDayNoteFocus?.();
      return;
    }
    setSelectedJour(dayNoteFocus.jour);
    setScreen("dayNote");
  }, [dayNoteFocus?.seq, dayNoteFocus?.jour, days, onClearDayNoteFocus]);

  useEffect(() => {
    if (!introFocus?.seq) return;
    setScreen("intro");
  }, [introFocus?.seq]);

  useEffect(() => {
    if (screen !== "dayNote") return;
    const local = loadDayNote(plan.id, selectedJour);
    setNoteSaved(Boolean(local?.text?.trim()));
  }, [screen, plan.id, selectedJour]);

  useEffect(() => {
    if (screen !== "timeline") return;
    const root = daysStripRef.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>(".plan-yv-day.is-selected");
    selected?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [screen, selectedJour, stageDays.length]);

  useEffect(() => {
    if (screen !== "timeline" || !hasStages || !selectedStage) return;
    const root = stagesStripRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>(
      `[data-stage="${selectedStage.id}"]`,
    );
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [screen, hasStages, selectedStage?.id]);

  useEffect(() => {
    if (!hasStages || !selectedStage || !stageDays.length) return;
    if (stageDays.some((day) => day.jour === selectedJour)) return;
    const unread = stageDays.find((day) => !isJourComplete(progress, day.jour));
    setSelectedJour(unread?.jour ?? stageDays[0]!.jour);
  }, [hasStages, selectedStage?.id, selectedJour, stageDays, progress]);

  const planTitle = plan.title.trim() || "Plan de lecture";
  const planShareMeta = (() => {
    const parts: string[] = [];
    if (scheduleTotal > 0) {
      parts.push(`${scheduleTotal} jour${scheduleTotal > 1 ? "s" : ""}`);
    }
    if (stages.length > 0) {
      parts.push(`${stages.length} étape${stages.length > 1 ? "s" : ""}`);
    }
    return parts.join(" · ");
  })();

  const selectedDay =
    days.find((day) => day.jour === selectedJour) ?? days[0] ?? null;
  const passage = selectedDay?.passage ?? "";
  const passageRefs = extractPassageRefs(passage);
  const passageLabel =
    passageRefs.length > 1 ? passageRefs.join("; ") : (passageRefs[0] ?? passage);
  const firstPassage = passageRefs[0] ?? extractPassageRef(passage);
  const passageRead = selectedDay
    ? isJourComplete(progress, selectedDay.jour)
    : false;
  const canOpenPassage = Boolean(
    firstPassage && onStartPlanReading && isPassageRef(firstPassage),
  );
  const hasDefinedChapter = passageHasDefinedChapter(selectedDay?.passage);
  const selectedIndex = selectedDay
    ? days.findIndex((day) => day.jour === selectedDay.jour) + 1
    : 0;
  const dayNoteLocal = loadDayNote(plan.id, selectedJour);
  const dayNoteDone = Boolean(dayNoteLocal?.text?.trim());
  const readingMinutes =
    passageRefs.length > 0 ? formatReadingTimeLabel(passageRefs) : null;
  const displayProgressTotal = hasStages ? stageDayTotal : scheduleTotal;
  const displayJourIndex = hasStages ? stageDayIndex : selectedIndex;
  const { done: progressDone } = progressCounts(plan, progress);
  const hasStartedPlan = progressDone > 0 || progress?.lastJour != null;

  const nextUnreadDay = useMemo(() => {
    if (!days.length) return null;
    const after = days.find(
      (day) => day.jour > selectedJour && !isJourComplete(progress, day.jour),
    );
    if (after) return after;
    const any = days.find((day) => !isJourComplete(progress, day.jour));
    if (any && any.jour !== selectedJour) return any;
    return null;
  }, [days, selectedJour, progress]);

  function pickStageJour(stage: { fromJour: number; toJour: number }) {
    const inStage = days.filter(
      (day) => day.jour >= stage.fromJour && day.jour <= stage.toJour,
    );
    const unread = inStage.find((day) => !isJourComplete(progress, day.jour));
    return unread?.jour ?? inStage[0]?.jour ?? stage.fromJour;
  }

  function selectStage(stage: { fromJour: number; toJour: number }) {
    const next = pickStageJour(stage);
    setSelectedJour(next);
    requestAnimationFrame(() => {
      const strip = daysStripRef.current;
      if (!strip) return;
      const btn = strip.querySelector<HTMLButtonElement>(`button[data-jour="${next}"]`);
      btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }

  function flowReturn(): PlanFlowReturn {
    if (screen === "dayNote") return "dayNote";
    if (screen === "intro") return "intro";
    return "timeline";
  }

  function openPassageAt(ref?: string) {
    const target = (ref ?? firstPassage ?? "").trim();
    if (!selectedDay || !target || !isPassageRef(target) || !onStartPlanReading) {
      return;
    }
    onStartPlanReading(selectedDay.jour, target, { returnTo: flowReturn() });
  }

  function openPassage() {
    openPassageAt();
  }

  function leaveDayNote() {
    onClearDayNoteFocus?.();
    setScreen("timeline");
  }

  function openDayNote() {
    if (!hasDefinedChapter) return;
    setScreen("dayNote");
  }

  function markIntroSeen() {
    setIntroSeen(true);
    saveIntroSeen(plan.id, true);
  }

  function openNextJour() {
    if (!nextUnreadDay || !onStartPlanReading) return;
    setSelectedJour(nextUnreadDay.jour);
    const refs = extractPassageRefs(nextUnreadDay.passage);
    const target = refs[0] ?? extractPassageRef(nextUnreadDay.passage);
    if (!target || !isPassageRef(target)) return;
    onStartPlanReading(nextUnreadDay.jour, target, { returnTo: "timeline" });
  }

  function startReading() {
    if (planComplete) {
      resetPlanProgress(plan.id);
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
    if (passageRead && nextUnreadDay) {
      openNextJour();
      return;
    }
    if (hasDescription && !introSeen) {
      setScreen("intro");
      return;
    }
    openPassage();
  }

  function toggleJourDone() {
    if (!selectedDay) return;
    markJourComplete(plan.id, selectedDay.jour);
    onMarkRead?.(selectedDay.jour);
  }

  const primaryCtaLabel = planComplete
    ? "Recommencer la lecture"
    : passageRead && nextUnreadDay
      ? "Jour suivant"
      : passageRead
        ? "Relire"
        : hasStartedPlan
          ? "Continuer la lecture"
          : "Commencer la lecture";

  if (screen === "intro") {
    return (
      <div className="today-view panel-nota-content plan-yv plan-yv-devo">
        <header className="plan-yv-devo-head">
          <button
            type="button"
            className="flash-list-back"
            onClick={() => {
              onClearIntroFocus?.();
              setScreen("timeline");
            }}
            aria-label="Retour au plan"
          >
            <YvIcon name="chevron_left" className="flash-list-back-icon" />
            Retour
          </button>
          <p className="plan-yv-devo-eyebrow">Description · Au démarrage</p>
          <h2 className="plan-yv-devo-title">{planTitle}</h2>
        </header>

        <div className="plan-yv-devo-scroll">
          <PlanDescription description={plan.description} title="Description" showTitle={false} />
          {canOpenPassage && passageLabel ? (
            <aside className="plan-yv-devo-next" aria-label="Lecture du jour">
              <p className="plan-yv-devo-next-kicker">Ensuite</p>
              <PassageRefsList
                refs={passageRefs}
                fallback={passageLabel}
                className="plan-yv-devo-next-ref"
              />
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
              onClearIntroFocus?.();
              setScreen("timeline");
            }}
          >
            {canOpenPassage ? "Commencer la lecture" : "Retour au plan"}
          </button>
        </footer>
      </div>
    );
  }

  if (screen === "dayNote" && hasDefinedChapter) {
    return (
      <PlanPersonalNotePanel
        planId={plan.id}
        planTitle={planTitle}
        jour={selectedJour}
        lead="Note du jour — ajoute une réflexion (optionnel)."
        saveLabel="Enregistrer"
        inputId="plan-day-note"
        onDismiss={() => {
          setNoteSaved(
            Boolean(loadDayNote(plan.id, selectedJour)?.text?.trim()),
          );
          leaveDayNote();
        }}
      />
    );
  }

  return (
    <div className="today-view panel-nota-content plan-yv plan-yv--workspace">
      <div className="plan-yv-main">
      <header className="page-session-head plan-yv-head">
        <div className="plan-yv-head-row">
          <button
            type="button"
            className="plan-yv-chrome-back"
            onClick={() => onLeave?.()}
            aria-label="Retour aux plans"
          >
            <YvIcon name="chevron_left" className="plan-yv-chrome-back-icon" />
          </button>
          <h2 className="page-title">{planTitle}</h2>
          <button
            type="button"
            className="plan-yv-share-btn"
            aria-label="Partager le plan"
            title="Partager le plan"
            onClick={() => setShareOpen(true)}
          >
            <YvIcon name="ios_share" className="plan-yv-share-icon" />
          </button>
        </div>
      </header>

      <BibleShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        mode="plan"
        refLabel={planTitle}
        verseText=""
        usfm=""
        planTitle={planTitle}
        planDescription={plan.description ?? ""}
        planMeta={planShareMeta}
        planId={plan.id}
      />

      {days.length ? (
        <section
          className={`plan-yv-timeline${hasStages ? " has-stages" : ""}`}
          aria-label={hasStages ? "Navigation du plan" : "Progression du plan"}
        >
          {hasStages && selectedStage ? (
            <div className="plan-yv-stage-catalog">
              <p className="plan-yv-section-label" id="plan-yv-stages-label">
                Étapes
              </p>
              <div
                ref={stagesStripRef}
                className="plan-yv-stages"
                role="tablist"
                aria-labelledby="plan-yv-stages-label"
              >
                {stages.map((stage) => {
                  const active = selectedStage.id === stage.id;
                  const inStage = days.filter(
                    (d) => d.jour >= stage.fromJour && d.jour <= stage.toJour,
                  );
                  const stageDoneCountLocal = inStage.filter((d) =>
                    isJourComplete(progress, d.jour),
                  ).length;
                  const stageTotalLocal = inStage.length;
                  const stageDone =
                    stageTotalLocal > 0 && stageDoneCountLocal === stageTotalLocal;
                  const stagePct =
                    stageTotalLocal > 0
                      ? Math.min(100, (stageDoneCountLocal / stageTotalLocal) * 100)
                      : 0;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      role="tab"
                      data-stage={stage.id}
                      aria-selected={active}
                      className={[
                        "plan-yv-stage",
                        active ? "is-active" : "",
                        stageDone ? "is-done" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => selectStage(stage)}
                      title={`${stage.title} · ${stageDoneCountLocal}/${stageTotalLocal}`}
                      aria-label={`Étape ${stage.id} · ${stage.title} · ${stageDoneCountLocal} sur ${stageTotalLocal}`}
                    >
                      <span
                        className="plan-yv-stage-num"
                        style={{ ["--stage-pct" as string]: String(stagePct / 100) }}
                        aria-hidden
                      >
                        {stageDone ? "✓" : stage.id}
                      </span>
                      <span className="plan-yv-stage-name">{stage.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="plan-yv-days-block">
            <div className="plan-yv-days-head">
              <p className="plan-yv-section-label" id="plan-yv-days-label">
                {hasStages && selectedStage
                  ? `Étape ${selectedStage.id}${selectedStage.title ? ` · ${selectedStage.title}` : ""}`
                  : "Jours"}
              </p>
              {selectedDay?.jour === planJour ? (
                <span className="plan-yv-days-today">Aujourd’hui</span>
              ) : null}
            </div>
            <div
              ref={daysStripRef}
              className={`plan-yv-days${stageDays.length <= 7 ? " is-fit" : ""}`}
              role="listbox"
              aria-labelledby="plan-yv-days-label"
            >
              {stageDays.map((day, idx) => {
                const selected = day.jour === selectedDay?.jour;
                const read = isJourComplete(progress, day.jour);
                const isCurrent = day.jour === planJour;
                const startDate = progress?.startedAt;
                const realDate = startDate ? planJourDate(startDate, day.jour) : null;
                const dateLabel = realDate ? formatPlanTileDate(realDate) : "Jour";
                const tileNum = hasStages ? idx + 1 : day.jour;
                return (
                  <button
                    key={day.jour}
                    type="button"
                    role="option"
                    data-jour={day.jour}
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
                      hasStages && selectedStage
                        ? `Étape ${selectedStage.id}, jour ${tileNum}`
                        : `Jour ${day.jour}`,
                      realDate ? dateLabel : null,
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
                    <span className="plan-yv-day-num">{tileNum}</span>
                    <span className="plan-yv-day-label">{dateLabel}</span>
                  </button>
                );
              })}
            </div>
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
              {displayJourIndex > 0
                ? `Jour ${displayJourIndex}${displayProgressTotal > 0 ? ` sur ${displayProgressTotal}` : ""}`
                : "Lecture du jour"}
              {selectedDay.jour === planJour ? " · Aujourd’hui" : null}
            </p>
          </div>
          {passageRefs.length > 0 || passageLabel ? (
            <PassageRefsList
              refs={passageRefs.length ? passageRefs : [passageLabel || "Passage du jour"]}
              className="plan-yv-hero-title"
              done={passageRead}
              onToggleDone={selectedDay ? toggleJourDone : undefined}
              onOpenRef={canOpenPassage ? openPassageAt : undefined}
            />
          ) : (
            <h3 className="plan-yv-hero-title">Passage du jour</h3>
          )}
          {readingMinutes ? (
            <p className="plan-yv-hero-meta">{readingMinutes}</p>
          ) : null}
          <button
            type="button"
            className="plan-yv-start"
            disabled={
              !planComplete &&
              !(passageRead && nextUnreadDay) &&
              !canOpenPassage &&
              !hasDescription
            }
            onClick={startReading}
          >
            {primaryCtaLabel}
          </button>
          {passageRead && nextUnreadDay && canOpenPassage ? (
            <button
              type="button"
              className="plan-yv-start-secondary"
              onClick={openPassage}
            >
              Relire ce jour
            </button>
          ) : null}
        </section>
      ) : (
        <p className="muted plan-yv-empty">
          Aucun verset pour ce jour — le plan n’affiche que les références bibliques.
        </p>
      )}
      </div>

      {hasDefinedChapter ? (
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
        </nav>
      ) : null}
    </div>
  );
}
