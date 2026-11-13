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
};

/** Progression UI (identité → contenu → publication) — pas les étapes du plan. */
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

  /** Em edição o id Firestore fica fixo; em criação deriva do titre. */
  const documentSlug = useMemo(
    () => (selected?.id ? selected.id : slugifyPlanId(title)),
    [selected?.id, title],
  );
  const extractionSeed = useMemo(
    () => (selected ? serializePlanExtraction(selected.etapes) : ""),
    [selected],
  );
  const canSave = canPersistReadingPlan(title, etapes);
  const canLeaveIdentity = Boolean(title.trim() && documentSlug);
  const canLeaveContent = canPersistReadingPlan(title, etapes);
  const editingExisting = Boolean(selected?.id);

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
      const result = await upsertReadingPlan(documentSlug, payload);
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

  function canJumpTo(index: WizardStepIndex): boolean {
    if (index === uiStep) return false;
    if (index < uiStep) return true;
    if (index === 1) return canLeaveIdentity;
    if (index === 2) return canLeaveIdentity && canLeaveContent;
    return false;
  }

  function goToStep(index: WizardStepIndex) {
    if (!canJumpTo(index) && index !== uiStep) return;
    setUiStep(index);
  }

  function goNext() {
    if (uiStep === 0 && !canLeaveIdentity) return;
    if (uiStep === 1 && !canLeaveContent) return;
    if (uiStep < 2) setUiStep((uiStep + 1) as WizardStepIndex);
  }

  function goBack() {
    if (uiStep > 0) setUiStep((uiStep - 1) as WizardStepIndex);
  }

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
        <ol className="editorial-admin-wizard-steps">
          {WIZARD_STEPS.map((step, index) => {
            const stepIndex = index as WizardStepIndex;
            const state =
              index < uiStep ? "done" : index === uiStep ? "current" : "todo";
            const jumpable = canJumpTo(stepIndex);
            return (
              <li key={step.id} className={`editorial-admin-wizard-step is-${state}`}>
                <button
                  type="button"
                  className="editorial-admin-wizard-step-btn"
                  disabled={disabled || busy || (!jumpable && index !== uiStep)}
                  aria-current={index === uiStep ? "step" : undefined}
                  onClick={() => goToStep(stepIndex)}
                >
                  <span className="editorial-admin-wizard-dot" aria-hidden />
                  <span className="editorial-admin-wizard-label">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <h2 id={titleId} className="type-eyebrow editorial-admin-wizard-current">
          {stepMeta.label}
        </h2>
      </header>

      {uiStep === 0 ? (
        <div className="profile-admin-form">
          <label className="profile-field">
            <span>Titre</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={disabled || busy}
              autoFocus
            />
          </label>
          {!editingExisting && documentSlug ? (
            <p className="muted type-caption editorial-admin-slug-hint">
              ID : {documentSlug}
            </p>
          ) : null}
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
      ) : null}

      {uiStep === 1 ? (
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
      ) : null}

      {uiStep === 2 ? (
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
            <span>Publier le plan</span>
          </label>
          <p className="muted type-caption">
            Décoche pour enregistrer en brouillon — tu pourras publier plus tard.
          </p>
        </div>
      ) : null}

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
          <>
            <button
              type="button"
              className="profile-save-btn"
              disabled={disabled || busy || !canSave}
              onClick={() => void save()}
            >
              {busy
                ? "Enregistrement…"
                : editingExisting
                  ? isPublished
                    ? "Enregistrer et publier"
                    : "Enregistrer le brouillon"
                  : isPublished
                    ? "Publier le plan"
                    : "Enregistrer le brouillon"}
            </button>
            {editingExisting ? (
              <button
                type="button"
                className="profile-delete-btn editorial-admin-delete-btn"
                disabled={disabled || busy}
                onClick={() => void remove()}
              >
                Supprimer
              </button>
            ) : null}
          </>
        )}
      </div>

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
    </section>
  );
}
