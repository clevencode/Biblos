import { useEffect, useState } from "react";
import { loadDayNote, saveDayNoteLocal } from "../domain/planDayNote";

export type PlanPersonalNotePanelProps = {
  planId: string;
  planTitle: string;
  jour: number;
  /** Sous-titre sous le titre du plan. */
  lead?: string;
  /** Libellé du CTA principal. */
  saveLabel?: string;
  inputId?: string;
  /** Passer / après enregistrement. */
  onDismiss: () => void;
};

/**
 * Note personnelle — UI partagée (fin d’étape + note du jour).
 */
export function PlanPersonalNotePanel({
  planId,
  planTitle,
  jour,
  lead = "Étape terminée — ajoute une note personnelle (optionnel).",
  saveLabel = "Ajouter la note",
  inputId = "plan-personal-note",
  onDismiss,
}: PlanPersonalNotePanelProps) {
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = loadDayNote(planId, jour);
    setNoteText(existing?.text ?? "");
  }, [planId, jour]);

  const canSaveNote = Boolean(noteText.trim()) && !busy;

  function saveAndFinish() {
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      saveDayNoteLocal(planId, jour, noteText);
      onDismiss();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="today-view panel-nota-content plan-yv plan-yv-devo plan-yv-day-note plan-yv-stage-note"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-personal-note-title"
    >
      <header className="plan-yv-devo-head">
        <h2 id="plan-personal-note-title" className="plan-yv-devo-title">
          {planTitle}
        </h2>
        <p className="muted plan-yv-stage-note-lead">{lead}</p>
      </header>

      <div className="plan-yv-devo-scroll plan-yv-stage-note-body">
        <label className="plan-yv-day-note-label" htmlFor={inputId}>
          Ta note
        </label>
        <textarea
          id={inputId}
          className="plan-yv-day-note-input plan-yv-stage-note-input"
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          placeholder="Écris ta réflexion…"
          rows={5}
          disabled={busy}
          autoFocus
        />
      </div>

      <footer className="plan-yv-devo-actions plan-yv-stage-note-actions">
        <button
          type="button"
          className="plan-yv-devo-mark"
          disabled={busy}
          onClick={onDismiss}
        >
          Passer
        </button>
        <button
          type="button"
          className="plan-yv-devo-continue"
          disabled={!canSaveNote}
          onClick={saveAndFinish}
        >
          {busy ? "Enregistrement…" : saveLabel}
        </button>
      </footer>
    </div>
  );
}

/** Alias — fin d’étape (lecteur Bible). */
export function PlanStageNotePanel(props: PlanPersonalNotePanelProps) {
  return <PlanPersonalNotePanel {...props} />;
}
