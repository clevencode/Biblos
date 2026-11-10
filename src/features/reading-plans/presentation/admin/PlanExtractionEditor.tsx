import { useEffect, useId, useMemo, useState } from "react";
import { parsePlanExtraction } from "../../domain/parsePlanExtraction";
import type { ReadingPlanEtape } from "../../domain/types";

type PlanExtractionEditorProps = {
  disabled?: boolean;
  initialExtraction?: string;
  onParsed: (result: {
    etapes: ReadingPlanEtape[];
    totalDays: number;
    validJourCount: number;
    errors: string[];
  }) => void;
};

/**
 * Presentation — parser linear em tempo real (input/colagem, zero botão intermédio).
 */
export function PlanExtractionEditor({
  disabled = false,
  initialExtraction = "",
  onParsed,
}: PlanExtractionEditorProps) {
  const areaId = useId();
  const [extractionArea, setExtractionArea] = useState(initialExtraction);

  useEffect(() => {
    setExtractionArea(initialExtraction);
  }, [initialExtraction]);

  const preview = useMemo(() => parsePlanExtraction(extractionArea), [extractionArea]);
  const parseErrors = preview.errors;

  useEffect(() => {
    const validJourCount = preview.etapes.reduce((n, e) => n + e.jours.length, 0);
    onParsed({
      etapes: preview.etapes,
      totalDays: preview.totalDays,
      validJourCount,
      errors: preview.errors,
    });
  }, [preview, onParsed]);

  return (
    <section className="profile-section" aria-labelledby={areaId}>
      <h2 id={areaId} className="type-eyebrow">
        Extraction (texte brut)
      </h2>
      <p className="muted type-caption">
        Format : <code>Étape 1 : Titre</code> puis <code>Jour 1 : Jean 3.16</code>
      </p>
      <label className="profile-field">
        <span className="sr-only">Zone d’extraction</span>
        <textarea
          className="editorial-admin-extract-area"
          rows={14}
          disabled={disabled}
          value={extractionArea}
          onInput={(e) => setExtractionArea(e.currentTarget.value)}
          spellCheck={false}
          placeholder={`Étape 1 : Introduction\nJour 1 : Jean 3.16\nJour 2 : Matthieu 5.1`}
        />
      </label>
      <div className="editorial-admin-live-meta" role="status" aria-live="polite">
        <span className="type-label">
          {preview.etapes.length
            ? `${preview.totalDays} jour(s) · ${preview.etapes.length} étape(s)`
            : "Aucune structure détectée"}
        </span>
      </div>
      {parseErrors.length ? (
        <ul className="editorial-admin-extract-errors" role="alert">
          {parseErrors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
