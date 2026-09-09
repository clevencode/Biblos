/**
 * Description = propriedade Notion `rich_text` do PLAN.
 * Mesma lógica do Resumo StudyOS: anotações → markdown leve → UI.
 * Soft-breaks (`<br>` / `\\n`) = quebras da propriedade; sem heurísticas de layout.
 */

import type { ReactNode } from "react";

export { richTextToMarkdown } from "../shared/notion.mjs";

/** Normaliza fonte Notion (MCP/API podem trazer <br>) — como normalizeResumoSource. */
export function normalizeDescriptionSource(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

/**
 * Remove marcadores não emparelhados (`**`, `~~`) para a UI não mostrar símbolos crus.
 * Pares válidos (formatação Notion) são preservados — inclusive a atravessar soft-breaks.
 */
export function stripOrphanFormatMarkers(raw: string): string {
  const vault: string[] = [];
  const stash = (token: string) => {
    vault.push(token);
    return `\u0001${vault.length - 1}\u0001`;
  };

  let text = raw.replace(/\*\*([\s\S]*?)\*\*/g, (_m, inner: string) => stash(`**${inner}**`));
  text = text.replace(/~~([\s\S]*?)~~/g, (_m, inner: string) => stash(`~~${inner}~~`));
  text = text.replace(/`([^`\n]+?)`/g, (_m, inner: string) => stash(`\`${inner}\``));
  text = text.replace(/<u>([\s\S]*?)<\/u>/gi, (_m, inner: string) => stash(`<u>${inner}</u>`));

  text = text.replace(/\*\*/g, "").replace(/~~/g, "");

  return text.replace(/\u0001(\d+)\u0001/g, (_m, idx: string) => vault[Number(idx)] ?? "");
}

/** Parágrafos = blocos separados por linha em branco (como no Notion / Resumo). */
export function splitDescriptionParagraphs(raw: string): string[] {
  const text = stripOrphanFormatMarkers(normalizeDescriptionSource(raw));
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

/**
 * Inline = anotações Notion. `**` / `~~` podem atravessar soft-breaks da propriedade;
 * `\\n` no texto plano vira `<br>` (sem mostrar símbolos crus).
 */
export function renderDescriptionInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*[\s\S]+?\*\*|~~[\s\S]+?~~|`[^`\n]+?`|<u>[\s\S]*?<\/u>|\[[^\]]+?\]\([^)]+?\)|\*[^*\n]+?\*)/g;
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
    } else if (token.startsWith("~~") && token.endsWith("~~") && token.length >= 4) {
      nodes.push(<s key={key.n++}>{renderDescriptionInline(token.slice(2, -2))}</s>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key.n++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("<u>") && token.endsWith("</u>")) {
      nodes.push(<u key={key.n++}>{renderDescriptionInline(token.slice(3, -4))}</u>);
    } else if (token.startsWith("[") && token.includes("](")) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (m) {
        nodes.push(
          <a key={key.n++} href={m[2]} target="_blank" rel="noreferrer">
            {renderDescriptionInline(m[1])}
          </a>,
        );
      } else {
        pushPlain(nodes, token, key);
      }
    } else if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      nodes.push(<em key={key.n++}>{renderDescriptionInline(token.slice(1, -1))}</em>);
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
    <p key={index} className="nota-resumo-p">
      {renderDescriptionInline(text)}
    </p>
  );
}
