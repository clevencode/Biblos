import { useEffect, useMemo, useRef, useState } from "react";
import { formatPlanTileDate } from "../calendar";
import { isPassageRef } from "../youversion/usfm";
import {
  extractPassageRef,
  extractPassageRefs,
  sanitizePlanDays,
  sanitizePlanStages,
  stageForJour,
} from "../plan";
import {
  loadDayNote,
  pullDayNote,
  pushDayNote,
  saveDayNoteLocal,
} from "../planDayNote";
import { formatReadingTimeLabel, parseVerseWindow } from "../planReading";
import { isPlanComplete, planJourDate, type PlanProgress } from "../planProgress";
import type { ReadingPlan } from "../types";
import { loadOrCreateProfile, preferredDisplayName } from "../userProfile";
import { PlanDescription } from "./PlanDescription";

type PlanFlowReturn = "timeline" | "dayNote" | "intro";

/** Jour avec au moins une référence à un chapitre biblique défini. */
function dayHasDefinedChapter(texte: string | undefined | null): boolean {
  const refs = extractPassageRefs(texte ?? "");
  if (refs.some((ref) => Boolean(parseVerseWindow(ref)))) return true;
  const single = extractPassageRef(texte ?? "");
  return Boolean(single && parseVerseWindow(single));
}

type TodayViewProps = {
  plan: ReadingPlan | null;
  progress?: PlanProgress | null;
  /** Jour calendaire « aujourd’hui » dans le plan. */
  planJour?: number;
  /** Jour à ouvrir / recentrer (le plus récent). */
  focusJour?: number;
  /** Remet l’écran sur la timeline (ex. retour depuis Lecture du plan). */
  resumeSeq?: number;
  /** Ouvre la note du jour après la lecture (seq change à chaque fois). */
  dayNoteFocus?: { jour: number; seq: number } | null;
  /** Restaure l’écran description au retour depuis la lecture. */
  introFocus?: { seq: number } | null;
  /** Quitte / ignore le focus note (évite de rouvrir le cycle). */
  onClearDayNoteFocus?: () => void;
  /** Quitte le focus description. */
  onClearIntroFocus?: () => void;
  onSelectGalerie?: () => void;
  onMarkRead?: (jour: number) => void;
  onOpenPassage?: (reference: string) => void;
  /** Démarre la lecture guidée du jour (versets → conclure). */
  onStartPlanReading?: (
    jour: number,
    passage: string,
    opts?: { returnTo?: PlanFlowReturn },
  ) => void;
  /** Remet le plan à zéro et relance la lecture. */
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
          {/* État « lu » = jour entier — un seul check (1.ª linha), não por passage. */}
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

export function TodayView({
  plan,
  progress = null,
  planJour = 1,
  focusJour,
  resumeSeq = 0,
  dayNoteFocus = null,
  introFocus = null,
  onClearDayNoteFocus,
  onClearIntroFocus,
  onSelectGalerie,
  onMarkRead,
  onOpenPassage,
  onStartPlanReading,
  onRestartPlan,
}: TodayViewProps) {
  const jumpJour = focusJour ?? planJour;
  const [screen, setScreen] = useState<PlanScreen>("timeline");
  const [selectedJour, setSelectedJour] = useState(jumpJour);
  const [introSeen, setIntroSeen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const daysStripRef = useRef<HTMLDivElement>(null);
  const stagesStripRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    if (!plan?.days?.length) return [];
    return sanitizePlanDays(plan.days);
  }, [plan]);

  const stages = useMemo(
    () => sanitizePlanStages(plan?.stages, days),
    [plan?.stages, days],
  );

  const scheduleTotal = days.length;
  const planComplete = isPlanComplete({ days }, progress);
  const hasDescription = Boolean(plan?.description?.trim());
  const hasStages = stages.length > 0;
  const selectedStage = stageForJour(stages, selectedJour) ?? (hasStages ? stages[0]! : undefined);
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
  }, [plan?.id, jumpJour, days]);

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
    if (dayNoteFocus?.seq || introFocus?.seq) return;
    setScreen("timeline");
    if (!days.length) return;
    const preferred =
      days.find((day) => day.jour === jumpJour)?.jour ?? days[0]!.jour;
    setSelectedJour(preferred);
  }, [resumeSeq, dayNoteFocus?.seq, introFocus?.seq, jumpJour, days]);

  useEffect(() => {
    if (!dayNoteFocus?.seq || !plan?.id) return;
    const day = days.find((d) => d.jour === dayNoteFocus.jour);
    if (!dayHasDefinedChapter(day?.texte)) {
      onClearDayNoteFocus?.();
      return;
    }
    setSelectedJour(dayNoteFocus.jour);
    setScreen("dayNote");
  }, [dayNoteFocus?.seq, dayNoteFocus?.jour, plan?.id, days, onClearDayNoteFocus]);

  useEffect(() => {
    if (!introFocus?.seq || !plan?.id) return;
    setScreen("intro");
  }, [introFocus?.seq, plan?.id]);

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
  }, [screen, selectedJour, stageDays.length]);

  useEffect(() => {
    if (screen !== "timeline" || !hasStages || !selectedStage) return;
    const root = stagesStripRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>(
      `.plan-yv-stage[data-stage="${selectedStage.id}"]`,
    );
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [screen, hasStages, selectedStage?.id]);

  useEffect(() => {
    if (!hasStages || !selectedStage || !stageDays.length) return;
    if (stageDays.some((day) => day.jour === selectedJour)) return;
    const unread = stageDays.find((day) => !progress?.completedDays.includes(day.jour));
    setSelectedJour(unread?.jour ?? stageDays[0]!.jour);
  }, [
    hasStages,
    selectedStage?.id,
    selectedJour,
    stageDays,
    progress?.completedDays,
  ]);

  if (!plan) {
    return (
      <div className="today-view panel-nota-content">
        <header className="page-session-head">
          <button
            type="button"
            className="flash-list-back"
            onClick={() => onSelectGalerie?.()}
            aria-label="Retour aux plans"
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
  const passageLabel =
    passageRefs.length > 1 ? passageRefs.join("; ") : (passageRefs[0] ?? passage);
  const firstPassage = passageRefs[0] ?? extractPassageRef(passage);
  const passageRead = selectedDay
    ? (progress?.completedDays.includes(selectedDay.jour) ?? false)
    : false;
  const canOpenPassage = Boolean(
    firstPassage && (onStartPlanReading || onOpenPassage) && isPassageRef(firstPassage),
  );
  const hasDefinedChapter = dayHasDefinedChapter(selectedDay?.texte);
  const selectedIndex = selectedDay ? days.findIndex((day) => day.jour === selectedDay.jour) + 1 : 0;
  const dayNoteLocal = loadDayNote(plan.id, selectedJour);
  const dayNoteDone = Boolean(dayNoteLocal?.text?.trim() || dayNoteLocal?.notionUrl);
  const readingMinutes =
    passageRefs.length > 0 ? formatReadingTimeLabel(passageRefs) : null;
  const displayProgressTotal = hasStages ? stageDayTotal : scheduleTotal;
  const displayJourIndex = hasStages ? stageDayIndex : selectedIndex;

  function pickStageJour(stage: { fromJour: number; toJour: number }) {
    const inStage = days.filter(
      (day) => day.jour >= stage.fromJour && day.jour <= stage.toJour,
    );
    const unread = inStage.find((day) => !progress?.completedDays.includes(day.jour));
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
    if (!selectedDay || !target || !isPassageRef(target)) return;
    if (onStartPlanReading) {
      onStartPlanReading(selectedDay.jour, target, { returnTo: flowReturn() });
      return;
    }
    onOpenPassage?.(target);
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
    const profile = loadOrCreateProfile();
    const planTitle = plan.theme?.trim() || plan.nome;
    const result = await pushDayNote(plan.id, plan.url, selectedJour, noteText, {
      planName: planTitle,
      passage: passageLabel,
      userId: profile.id,
      displayName: preferredDisplayName(profile),
    });
    setNoteBusy(false);
    if (!result.ok) {
      setNoteMsg("Enregistré sur cet appareil — sync plus tard");
      setNoteSaved(Boolean(noteText.trim()));
      if (andClose) {
        onClearDayNoteFocus?.();
        setScreen("timeline");
      }
      return;
    }
    setNoteSaved(true);
    setNoteMsg("Note enregistrée sur cet appareil");
    if (andClose) {
      onClearDayNoteFocus?.();
      setScreen("timeline");
    }
  }

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
              <PassageRefsList refs={passageRefs} fallback={passageLabel} className="plan-yv-devo-next-ref" />
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
      <div className="today-view panel-nota-content plan-yv plan-yv-devo plan-yv-day-note">
        <header className="plan-yv-devo-head">
          <button
            type="button"
            className="flash-list-back"
            onClick={leaveDayNote}
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
          {passageLabel ? (
            <PassageRefsList
              refs={passageRefs}
              fallback={passageLabel}
              className="plan-yv-day-note-ref muted"
              onOpenRef={canOpenPassage ? openPassageAt : undefined}
            />
          ) : null}
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
            onClick={leaveDayNote}
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
            aria-label="Retour aux plans"
          >
            ←
          </button>
          <h2 className="page-title">{planTitle}</h2>
        </div>
      </header>

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
                    progress?.completedDays.includes(d.jour),
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
                const read = progress?.completedDays.includes(day.jour) ?? false;
                const isCurrent = day.jour === planJour;
                const startDate = progress?.startDate;
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
              onToggleDone={
                onMarkRead && selectedDay ? () => onMarkRead(selectedDay.jour) : undefined
              }
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
            disabled={!planComplete && !canOpenPassage && !hasDescription}
            onClick={startReading}
          >
            {planComplete
              ? "Recommencer la lecture"
              : passageRead
                ? "Relire"
                : "Commencer la lecture"}
          </button>
        </section>
      ) : (
        <p className="muted plan-yv-empty">
          Aucun verset pour ce jour — le plan n’affiche que les références bibliques.
        </p>
      )}

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
