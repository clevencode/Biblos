/**
 * Description = propriedade Notion `rich_text` do PLAN.
 * Sync/UI: mesmo papel do Resumo no StudyOS.
 */

/** Normaliza fonte Notion (MCP/API podem trazer <br>). */
export function normalizeDescriptionSource(raw: string): string {
  return raw.replace(/<br\s*\/?>/gi, "\n").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
}

/** Parágrafos = blocos separados por linha em branco (como no Notion). */
export function splitDescriptionParagraphs(raw: string): string[] {
  const text = normalizeDescriptionSource(raw);
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
