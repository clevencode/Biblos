import type { ReactNode } from "react";

function normalizeDescriptionSource(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function splitDescriptionParagraphs(raw: string): string[] {
  const text = normalizeDescriptionSource(raw);
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function pushPlain(nodes: ReactNode[], text: string, key: { n: number }) {
  if (!text) return;
  const parts = text.split("\n");
  for (let i = 0; i < parts.length; i += 1) {
    if (i > 0) nodes.push(<br key={`br-${key.n++}`} />);
    if (parts[i]) nodes.push(parts[i]);
  }
}

export function renderDescriptionInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[\s\S]+?\*\*|`[^`\n]+?`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  const key = { n: 0 };

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      pushPlain(nodes, text.slice(last, match.index), key);
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      nodes.push(
        <strong key={key.n++}>{renderDescriptionInline(token.slice(2, -2))}</strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key.n++}>{token.slice(1, -1)}</code>);
    } else {
      pushPlain(nodes, token, key);
    }
    last = match.index + token.length;
  }

  if (last < text.length) pushPlain(nodes, text.slice(last), key);
  return nodes;
}

export function renderDescriptionParagraph(text: string, index: number): ReactNode {
  return (
    <p
      key={index}
      className={index === 0 ? "nota-resumo-p nota-resumo-p--lead" : "nota-resumo-p"}
    >
      {renderDescriptionInline(text)}
    </p>
  );
}
