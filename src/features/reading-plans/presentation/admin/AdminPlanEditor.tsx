import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { ReadingPlan, ReadingPlanEtape } from "../../domain/types";
import { canPersistReadingPlan } from "../../domain/planSaveRules";
import { slugifyPlanId } from "../../domain/planSlug";
import { serializePlanExtraction } from "../../domain/serializePlanExtraction";
import {
  deleteReadingPlan,
  upsertReadingPlan,
} from "../../data/readingPlansWriteRepository";
import { PlanExtractionEditor } from "./PlanExtractionEditor";

type AdminPlanEditorProps = {
  disabled: boolean;
  selected: ReadingPlan | null;
  onSaved: () => void;
  onClear: () => void;
  /**
   * `wizard` = progression UI (identité → contenu → publication).
   * Ne confond pas avec les étapes du plan de lecture.
   */
  variant?: "flat" | "wizard";
};

const WIZARD_STEPS = [
  { id: "identity", label: "Identité" },
  { id: "content", label: "Contenu" },
  { id: "publish", label: "Publication" },
] as const;

type WizardStepIndex = 0 | 1 | 2;

export function AdminPlanEditor({
  disabled,
  selected,
  onSaved,
  onClear,
  variant = "flat",
}: AdminPlanEditorProps) {
  const titleId = useId();
  const progressId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [etapes, setEtapes] = useState<ReadingPlanEtape[]>([]);
  const [totalDays, setTotalDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uiStep, setUiStep] = useState<WizardStepIndex>(0);

  const documentSlug = useMemo(() => slugifyPlanId(title), [title]);
  const extractionSeed = useMemo(
    () => (selected ? serializePlanExtraction(selected.etapes) : ""),
    [selected],
  );
  const canSave = canPersistReadingPlan(title, etapes);
  const canLeaveIdentity = Boolean(title.trim() && documentSlug);
  const canLeaveContent = canPersistReadingPlan(title, etapes);
  const wizard = variant === "wizard";

  useEffect(() => {
    setUiStep(0);
    setMessage(null);
    setError(null);
    if (!selected) {
      setTitle("");
      setDescription("");
      setIsPublished(false);
      setEtapes([]);
      setTotalDays(0);
      return;
    }
    setTitle(selected.title);
    setDescription(selected.description);
    setIsPublished(selected.isPublished);
    setEtapes(selected.etapes);
    setTotalDays(selected.totalDays);
  }, [selected]);

  const handleParsed = useCallback(
    (result: {
      etapes: ReadingPlanEtape[];
      totalDays: number;
    }) => {
      setEtapes(result.etapes);
      setTotalDays(result.totalDays);
    },
    [],
  );

  async function save() {
    if (!canSave || !documentSlug) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title: title.trim(),
        description,
        isPublished,
        totalDays,
        etapes,
      };
      const previousId = selected?.id ?? null;
      const result = await upsertReadingPlan(documentSlug, payload);
      if (previousId && previousId !== result.id) {
        await deleteReadingPlan(previousId);
      }
      setMessage(`Enregistré : ${result.id}`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d’enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const id = selected?.id;
    if (!id) return;
    if (!window.confirm(`Supprimer le plan « ${title || id} » ?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteReadingPlan(id);
      setMessage("Plan supprimé");
      onClear();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    if (uiStep === 0 && !canLeaveIdentity) return;
    if (uiStep === 1 && !canLeaveContent) return;
    if (uiStep < 2) setUiStep((uiStep + 1) as WizardStepIndex);
  }

  function goBack() {
    if (uiStep > 0) setUiStep((uiStep - 1) as WizardStepIndex);
  }

  const identityFields = (
    <div className="profile-admin-form">
      <label className="profile-field">
        <span>ID document (slug)</span>
        <input
          value={documentSlug}
          readOnly
          tabIndex={-1}
          className="is-locked"
          aria-readonly="true"
          placeholder="—"
        />
      </label>
      <label className="profile-field">
        <span>Titre</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled || busy}
          autoFocus={wizard && uiStep === 0}
        />
      </label>
      <label className="profile-field">
        <span>Description</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled || busy}
        />
      </label>
    </div>
  );

  const contentFields = (
    <>
      <PlanExtractionEditor
        key={selected?.id ?? "new"}
        disabled={disabled || busy}
        initialExtraction={extractionSeed}
        onParsed={handleParsed}
      />
      <p className="muted type-caption editorial-admin-structure-hint">
        Aperçu structure : {etapes.length} étape(s) · {totalDays} jour(s)
      </p>
    </>
  );

  const publishFields = (
    <div className="profile-admin-form editorial-admin-publish-step">
      <div className="editorial-admin-publish-summary" role="status">
        <p className="editorial-admin-publish-title">{title.trim() || "—"}</p>
        <p className="muted type-caption">
          {documentSlug || "—"} · {etapes.length} étape(s) · {totalDays} jour(s)
        </p>
        {description.trim() ? (
          <p className="muted type-caption editorial-admin-publish-desc">
            {description.trim()}
          </p>
        ) : null}
      </div>
      <label className="editorial-admin-check">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          disabled={disabled || busy}
        />
        <span>Publier maintenant (`isPublished`)</span>
      </label>
      <p className="muted type-caption">
        Décoche pour enregistrer en brouillon. Tu pourras publier plus tard.
      </p>
    </div>
  );

  const feedback = (
    <>
      {message ? (
        <p className="editorial-admin-ok profile-saved" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="editorial-admin-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  if (wizard) {
    const stepMeta = WIZARD_STEPS[uiStep];
    return (
      <section
        className="profile-section editorial-admin-editor-surface is-wizard"
        aria-labelledby={titleId}
      >
        <header className="editorial-admin-wizard-progress" aria-labelledby={progressId}>
          <p id={progressId} className="sr-only">
            Progression du formulaire : étape {uiStep + 1} sur {WIZARD_STEPS.length}
          </p>
          <ol className="editorial-admin-wizard-steps" aria-hidden="true">
            {WIZARD_STEPS.map((step, index) => {
              const state =
                index < uiStep ? "done" : index === uiStep ? "current" : "todo";
              return (
                <li
                  key={step.id}
                  className={`editorial-admin-wizard-step is-${state}`}
                >
                  <span className="editorial-admin-wizard-dot" />
                  <span className="editorial-admin-wizard-label">{step.label}</span>
                </li>
              );
            })}
          </ol>
          <h2 id={titleId} className="type-eyebrow editorial-admin-wizard-current">
            {stepMeta.label}
          </h2>
        </header>

        {uiStep === 0 ? identityFields : null}
        {uiStep === 1 ? contentFields : null}
        {uiStep === 2 ? publishFields : null}

        <div className="editorial-admin-wizard-nav profile-name-actions">
          {uiStep > 0 ? (
            <button
              type="button"
              className="profile-save-btn is-ghost"
              disabled={disabled || busy}
              onClick={goBack}
            >
              Retour
            </button>
          ) : null}
          {uiStep < 2 ? (
            <button
              type="button"
              className="profile-save-btn"
              disabled={
                disabled ||
                busy ||
                (uiStep === 0 && !canLeaveIdentity) ||
                (uiStep === 1 && !canLeaveContent)
              }
              onClick={goNext}
            >
              Continuer
            </button>
          ) : (
            <button
              type="button"
              className="profile-save-btn"
              disabled={disabled || busy || !canSave}
              onClick={() => void save()}
            >
              {busy
                ? "Enregistrement…"
                : isPublished
                  ? "Publier le plan"
                  : "Enregistrer le brouillon"}
            </button>
          )}
        </div>

        {feedback}
      </section>
    );
  }

  return (
    <section className="profile-section editorial-admin-editor-surface" aria-labelledby={titleId}>
      <header className="editorial-admin-editor-head">
        <h2 id={titleId} className="type-title">
          {selected ? "Modifier le plan" : "Nouveau plan"}
        </h2>
        {selected ? (
          <button type="button" className="profile-text-btn" onClick={onClear}>
            Nouveau
          </button>
        ) : null}
      </header>

      {identityFields}
      <label className="editorial-admin-check">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          disabled={disabled || busy}
        />
        <span>Publié (`isPublished`)</span>
      </label>

      {contentFields}

      <div className="profile-name-actions">
        <button
          type="button"
          className="profile-save-btn"
          disabled={disabled || busy || !canSave}
          onClick={() => void save()}
        >
          {busy ? "Enregistrement…" : "Enregistrer dans Firestore"}
        </button>
        {selected?.id ? (
          <button
            type="button"
            className="profile-delete-btn editorial-admin-delete-btn"
            disabled={disabled || busy}
            onClick={() => void remove()}
          >
            Supprimer
          </button>
        ) : null}
      </div>

      {feedback}
    </section>
  );
}
