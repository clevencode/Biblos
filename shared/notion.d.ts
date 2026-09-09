/** Tipagens para shared/notion.mjs (consumidores TypeScript / editores). */

export const NOTION_VERSION: string;

export function pageIdFromNotionUrl(urlOrId: string): string | null;
export function pageId(url: string): string | null;
export function pageUuid(hex32: string): string | null;
export function dateKey(value: string | Date): string;

export function normalizeCategoria(
  value: string | null | undefined,
): "facil" | "medio" | "dificil" | null;
export function normalizeStatus(
  value: string | null | undefined,
): "estudo" | "espera" | "encerrado" | null;
export function categoriaToNotion(
  categoria: "facil" | "medio" | "dificil" | null | undefined,
): string | null;
export function statusToNotion(
  status: "estudo" | "espera" | "encerrado" | null | undefined,
): string | null;
export function categoriaPropFromPage(props: Record<string, unknown> | null | undefined): unknown;
export const BIBLECARDS_DB: string;
export const PLAN_DB: string;
export function ensureLembrete(
  card: { status?: string | null; lembrete?: string | null; criadoEm?: string | null },
  today?: string,
): string | null;

export function richTextToMarkdown(segments: unknown): string;
export function resumoFromProp(p: Record<string, unknown> | null | undefined): string;

export function sleep(ms: number): Promise<void>;
export function notionHeaders(token: string, extra?: Record<string, string>): Record<string, string>;

export function notionFetch(
  url: string,
  init: RequestInit,
  retries?: number,
): Promise<
  | { ok: true; response: Response; detail: string }
  | { ok: false; response: Response; detail: string }
>;

export function notionGet(token: string, path: string): Promise<Record<string, unknown>>;
export function propResumoFull(
  token: string,
  pageId: string,
  props: Record<string, unknown>,
): Promise<string>;
export function propRichTextFull(
  token: string,
  pageId: string,
  props: Record<string, unknown>,
  propName: string,
): Promise<string>;
export function propDescriptionFull(
  token: string,
  pageId: string,
  props: Record<string, unknown>,
): Promise<string>;

export type ResumoSyncResult = {
  ok: boolean;
  resumo: string;
  hasToken: boolean;
  pageId?: string;
  error?: string;
};

export type DescriptionSyncResult = {
  ok: boolean;
  description: string;
  hasToken: boolean;
  pageId?: string;
  error?: string;
};

export function fetchNotionResumo(token: string, urlOrId: string): Promise<ResumoSyncResult>;
export function fetchNotionDescription(token: string, urlOrId: string): Promise<DescriptionSyncResult>;
export function createVerseCard(
  token: string,
  input: {
    frente: string;
    verso: string;
    localId?: string;
    lembrete?: string | null;
    status?: string;
    categoria?: string | null;
  },
): Promise<{
  ok: boolean;
  error?: string;
  hasToken?: boolean;
  localId?: string | null;
  card?: {
    id: string;
    frente: string;
    verso: string;
    categoria: string | null;
    status: string;
    url: string;
    lembrete: string | null;
    cardCategory: string;
    criadoEm: string | null;
  };
}>;
export function isStatusOptionValidationError(statusCode: number, detail: string): boolean;
export function notesDatabaseId(): string;
