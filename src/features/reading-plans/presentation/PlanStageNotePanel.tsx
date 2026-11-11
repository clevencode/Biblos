import { useEffect, useState } from "react";
import { YvIcon } from "../../../components/YvIcon";
import { loadDayNote, saveDayNoteLocal } from "../domain/planDayNote";

type PlanStageNotePanelProps = {
  planId: string;
  planTitle: string;
  jour: number;
  stageIndex?: number;
  stageName?: string;
  /** Annuler / passer / après enregistrement → retour aux plans. */
  onDismiss: () => void;
};

/**
 * Après fin d’étape — note personnelle (passer ou enregistrer) puis retour plans.
 */
export function PlanStageNotePanel({
  planId,
  planTitle,
  jour,
  stageIndex,
  stageName,
  onDismiss,
}: PlanStageNotePanelProps) {
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = loadDayNote(planId, jour);
    setNoteText(existing?.text ?? "");
  }, [planId, jour]);

  const stageLabel =
    stageIndex != null
      ? stageName?.trim()
        ? `Étape ${stageIndex} · ${stageName.trim()}`
        : `Étape ${stageIndex}`
      : stageName?.trim() || "Étape terminée";

  function saveAndFinish() {
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
      aria-labelledby="plan-stage-note-title"
    >
      <header className="plan-yv-devo-head">
        <button
          type="button"
          className="flash-list-back"
          onClick={onDismiss}
          aria-label="Annuler et retourner aux plans"
        >
          <YvIcon name="chevron_left" className="flash-list-back-icon" />
          Annuler
        </button>
        <p className="plan-yv-devo-eyebrow">{stageLabel}</p>
        <h2 id="plan-stage-note-title" className="plan-yv-devo-title">
          {planTitle}
        </h2>
        <p className="muted plan-yv-stage-note-lead">
          Étape terminée — ajoute une note personnelle (optionnel).
        </p>
      </header>

      <div className="plan-yv-devo-scroll">
        <label className="plan-yv-day-note-label" htmlFor="plan-stage-note">
          Ta note
        </label>
        <textarea
          id="plan-stage-note"
          className="plan-yv-day-note-input"
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          placeholder="Écris ta réflexion…"
          rows={10}
          disabled={busy}
          autoFocus
        />
      </div>

      <footer className="plan-yv-devo-actions">
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
          disabled={busy}
          onClick={saveAndFinish}
        >
          {busy ? "Enregistrement…" : "Ajouter la note"}
        </button>
      </footer>
    </div>
  );
}
