import { useMemo } from "react";
import {
  renderDescriptionParagraph,
  splitDescriptionParagraphs,
} from "../descriptionNotion";

type PlanDescriptionProps = {
  description?: string | null;
};

/** Propriedade Notion Description — mesma formatação do Resumo StudyOS. */
export function PlanDescription({ description }: PlanDescriptionProps) {
  const paragraphs = useMemo(
    () => splitDescriptionParagraphs(description ?? ""),
    [description],
  );

  if (!paragraphs.length) {
    return (
      <p className="muted">
        Pas de Description dans Notion — écris la propriété Description manuellement sur le plan.
      </p>
    );
  }

  return (
    <section className="nota-resumo" aria-label="Description">
      <h3>Description</h3>
      <div className="nota-resumo-body">{paragraphs.map(renderDescriptionParagraph)}</div>
    </section>
  );
}
