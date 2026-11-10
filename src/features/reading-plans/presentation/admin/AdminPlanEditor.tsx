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

export function AdminPlanEditor({
  disabled,
  selected,
  onSaved,
  onClear,
}: AdminPlanEditorProps) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [etapes, setEtapes] = useState<ReadingPlanEtape[]>([]);
  const [totalDays, setTotalDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const documentSlug = useMemo(() => slugifyPlanId(title), [title]);
  const extractionSeed = useMemo(
    () => (selected ? serializePlanExtraction(selected.etapes) : ""),
    [selected],
  );
  const canSave = canPersistReadingPlan(title, etapes);

  useEffect(() => {
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

  return (
    <section className="profile-section editorial-admin-editor-surface" aria-labelledby={titleId}>
      <header className="editorial-admin-editor-head">
        <h2 id={titleId} className="type-title">
          {selected ? "Modifier le plan" : "Nouveau plan"}
        </h2>
        <button type="button" className="profile-text-btn" onClick={onClear}>
          Nouveau
        </button>
      </header>

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
        <label className="editorial-admin-check">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            disabled={disabled || busy}
          />
          <span>Publié (`isPublished`)</span>
        </label>
      </div>

      <PlanExtractionEditor
        key={selected?.id ?? "new"}
        disabled={disabled || busy}
        initialExtraction={extractionSeed}
        onParsed={handleParsed}
      />

      <p className="muted type-caption editorial-admin-structure-hint">
        Aperçu structure : {etapes.length} étape(s) · {totalDays} jour(s)
      </p>

      <div className="profile-name-actions">
        <button
          type="button"
          className="profile-save-btn"
          disabled={disabled || busy || !canSave}
          onClick={save}
        >
          {busy ? "Enregistrement…" : "Enregistrer dans Firestore"}
        </button>
        {selected?.id ? (
          <button
            type="button"
            className="profile-delete-btn editorial-admin-delete-btn"
            disabled={disabled || busy}
            onClick={remove}
          >
            Supprimer
          </button>
        ) : null}
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
