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

/** Propriedade Notion Description — intro do plano (só ao iniciar). */
export function PlanDescription({
  description,
  title = "Description",
  showTitle = true,
}: PlanDescriptionProps) {
  const paragraphs = useMemo(
    () => splitDescriptionParagraphs(description ?? ""),
    [description],
  );

  if (!paragraphs.length) {
    return (
      <div className="plan-yv-devo-empty" role="status">
        <p className="plan-yv-devo-empty-title">Pas encore de description</p>
        <p className="plan-yv-devo-empty-copy">
          La description de ce plan n’est pas encore disponible.
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
