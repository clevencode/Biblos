import { useMemo } from "react";
import {
  renderDescriptionParagraph,
  splitDescriptionParagraphs,
} from "../descriptionNotion";

type PlanDescriptionProps = {
  description?: string | null;
  title?: string;
};

/** Propriedade Notion Devotional — mesma formatação do Resumo StudyOS. */
export function PlanDescription({ description, title = "Devotional" }: PlanDescriptionProps) {
  const paragraphs = useMemo(
    () => splitDescriptionParagraphs(description ?? ""),
    [description],
  );

  if (!paragraphs.length) {
    return (
      <p className="muted">
        Pas de Devotional dans Notion — écris la propriété Devotional manuellement sur le plan.
      </p>
    );
  }

  return (
    <section className="nota-resumo" aria-label={title}>
      <h3>{title}</h3>
      <div className="nota-resumo-body">{paragraphs.map(renderDescriptionParagraph)}</div>
    </section>
  );
}
