import { Fragment, useMemo, type ReactNode } from "react";
import { splitDescriptionParagraphs } from "../descriptionNotion";

type PlanDescriptionProps = {
  description?: string | null;
};

/** Inline Notion-ish markdown: **bold**, *italic*, `code`, ~~strike~~, <u>. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|~~[^~]+?~~|<u>[\s\S]*?<\/u>|\[[^\]]+?\]\([^)]+?\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key++}>{renderInline(token.slice(2, -2))}</strong>);
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push(<s key={key++}>{renderInline(token.slice(2, -2))}</s>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("<u>") && token.endsWith("</u>")) {
      nodes.push(<u key={key++}>{renderInline(token.slice(3, -4))}</u>);
    } else if (token.startsWith("[") && token.includes("](")) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (m) {
        nodes.push(
          <a key={key++} href={m[2]} target="_blank" rel="noreferrer">
            {renderInline(m[1])}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key++}>{renderInline(token.slice(1, -1))}</em>);
    } else {
      nodes.push(token);
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderParagraph(text: string, index: number): ReactNode {
  const lines = text.split("\n");
  return (
    <p key={index} className="nota-resumo-p">
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 ? <br /> : null}
          {renderInline(line)}
        </Fragment>
      ))}
    </p>
  );
}

/** Affiche la propriété Notion Description (comme Resumo StudyOS). */
export function PlanDescription({ description }: PlanDescriptionProps) {
  const paragraphs = useMemo(
    () => splitDescriptionParagraphs(description ?? ""),
    [description],
  );

  if (!paragraphs.length) {
    return (
      <p className="muted today-description-empty">
        Pas de Description dans Notion — écris la propriété Description sur le plan.
      </p>
    );
  }

  return (
    <section className="nota-resumo today-description" aria-label="Description">
      <h3>Description</h3>
      <div className="nota-resumo-body">{paragraphs.map(renderParagraph)}</div>
    </section>
  );
}
