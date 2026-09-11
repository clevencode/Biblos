import { useMemo } from "react";
import {
  renderDescriptionParagraph,
  splitDescriptionParagraphs,
} from "../descriptionNotion";

type PlanDescriptionProps = {
  description?: string | null;
  title?: string;
  /** Affiche le titre de section (défaut: true). */
  showTitle?: boolean;
};

/** Propriedade Notion Devotional — mesma formatação do Resumo StudyOS. */
export function PlanDescription({
  description,
  title = "Devotional",
  showTitle = true,
}: PlanDescriptionProps) {
  const paragraphs = useMemo(
    () => splitDescriptionParagraphs(description ?? ""),
    [description],
  );

  if (!paragraphs.length) {
    return (
      <div className="plan-yv-devo-empty" role="status">
        <p className="plan-yv-devo-empty-title">Pas encore de Devotional</p>
        <p className="plan-yv-devo-empty-copy">
          Ajoute le texte dans la propriété <strong>Devotional</strong> de ce plan sur Notion
          pour l’afficher ici.
        </p>
      </div>
    );
  }

  return (
    <section className="nota-resumo plan-yv-devo-body" aria-label={title}>
      {showTitle ? <h3>{title}</h3> : null}
      <div className="nota-resumo-body">{paragraphs.map(renderDescriptionParagraph)}</div>
    </section>
  );
}
