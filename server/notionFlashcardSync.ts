import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  pageId,
  notionFetch,
  isStatusOptionValidationError,
  sleep,
  notionHeaders,
  statusToNotion,
  categoriaPropFromPage,
  categoriaToNotion as categoriaToNotionShared,
} from "../shared/notion.mjs";
import { ensureLembrete, normalizeCategoria, normalizeStatus } from "../src/retention";
import { dateKey } from "../src/calendar";

export type SyncBody = {
  url?: string;
  lembrete?: string | null;
  categoria?: "facil" | "medio" | "dificil" | null;
  status?: "estudo" | "espera" | "encerrado";
  pull?: boolean;
  persist?: boolean;
  urls?: string[];
};

export type CardRemoteState = {
  url: string;
  categoria: "facil" | "medio" | "dificil" | null;
  lembrete: string | null;
  status: "estudo" | "espera" | "encerrado" | null;
  criadoEm?: string | null;
  error?: string;
};

type QueueItem = SyncBody & { url: string; at: string };

const SEED_PATH = join(process.cwd(), "src", "data", "seed.json");

export { pageId };

function queueFile() {
  return join(process.cwd(), "scripts", "lembrete-queue.json");
}

function readQueue(): QueueItem[] {
  try {
    const data = JSON.parse(readFileSync(queueFile(), "utf8")) as { pending?: QueueItem[] };
    return data.pending ?? [];
  } catch {
    return [];
  }
}

function writeQueue(pending: QueueItem[]) {
  const file = queueFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ pending }, null, 2)}\n`, "utf8");
}

function enqueue(body: SyncBody & { url: string }) {
  const id = pageId(body.url);
  writeQueue([...readQueue().filter((item) => pageId(item.url) !== id), { ...body, at: new Date().toISOString() }]);
}

function dequeue(url: string) {
  writeQueue(readQueue().filter((item) => pageId(item.url) !== pageId(url)));
}

type PatchResult = { ok: true } | { ok: false; error: string };

function humanizeNotionError(statusCode: number, detail: string): string {
  const lower = detail.toLowerCase();
  if (
    statusCode === 503 ||
    lower.includes("network_error") ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("enoent") ||
    lower.includes("getaddrinfo")
  ) {
    return "Notion: sem ligação à API";
  }
  if (statusCode === 429 || lower.includes("rate_limited") || lower.includes("rate limited")) {
    return "Notion: limite de pedidos — tenta outra vez dentro de momentos";
  }
  if (statusCode === 401 || statusCode === 403) return "Notion: token sem permissão nesta página";
  if (isStatusOptionValidationError(statusCode, detail)) {
    return "Notion: opção de Status inválida (ex.: Encerrado)";
  }
  if (lower.includes("validation_error") && (lower.includes("categoria") || lower.includes("select"))) {
    return "Notion: opção de Categoria inválida";
  }
  if (statusCode === 404) return "Notion: página do cartão não encontrada";
  try {
    const parsed = JSON.parse(detail) as { message?: string };
    if (parsed?.message) return `Notion ${statusCode}: ${parsed.message.slice(0, 140)}`;
  } catch {
    /* texto bruto */
  }
  const short = detail.replace(/\s+/g, " ").trim().slice(0, 120);
  return short ? `Notion ${statusCode}: ${short}` : `Notion ${statusCode}`;
}

export async function fetchNotionCard(token: string, url: string): Promise<CardRemoteState> {
  const id = pageId(url);
  if (!id) return { url, categoria: null, lembrete: null, status: null, error: "URL Notion inválida" };

  const { ok, response, detail } = await notionFetch(`https://api.notion.com/v1/pages/${id}`, {
    method: "GET",
    headers: notionHeaders(token),
  });

  if (!ok) {
    return {
      url,
      categoria: null,
      lembrete: null,
      status: null,
      error: humanizeNotionError(response.status, detail),
    };
  }

  const page = (await response.json()) as {
    created_time?: string;
    properties?: Record<
      string,
      {
        type?: string;
        select?: { name?: string } | null;
        status?: { name?: string } | null;
        date?: { start?: string | null } | null;
        created_time?: string;
      }
    >;
  };
  const props = page.properties ?? {};
  const catProp = categoriaPropFromPage(props) as { select?: { name?: string } } | null;
  const categoriaRaw = catProp?.select?.name ?? null;
  const statusRaw = (props.Status as { status?: { name?: string } } | undefined)?.status?.name ?? null;
  const lembreteRaw = (props.Lembrete as { date?: { start?: string } } | undefined)?.date?.start ?? null;
  const criadoEm = props["Criado em"]?.created_time || page.created_time || null;
  const status = normalizeStatus(statusRaw);
  const lembrete =
    lembreteRaw?.slice(0, 10) ??
    ensureLembrete({
      status: status ?? "estudo",
      lembrete: null,
      categoria: normalizeCategoria(categoriaRaw),
      criadoEm,
    });

  return {
    url,
    categoria: normalizeCategoria(categoriaRaw),
    lembrete,
    status,
    criadoEm: criadoEm ? dateKey(criadoEm) : null,
  };
}

export async function pullNotionCards(token: string, urls: string[]): Promise<CardRemoteState[]> {
  const unique = [...new Set(urls.filter((item) => pageId(item)))];
  const concurrency = 2;
  const out: CardRemoteState[] = new Array(unique.length);
  let next = 0;

  async function worker() {
    while (next < unique.length) {
      const index = next;
      next += 1;
      out[index] = await fetchNotionCard(token, unique[index]);
      if (index + 1 < unique.length) await sleep(120);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()));
  return out;
}

function pageKeyFromUrl(url: string): string {
  return (pageId(url) ?? "").replace(/-/g, "").toLowerCase();
}

/** Grava Lembrete/Categoria/Status no seed.json (só em ambiente local com FS gravável). */
export function persistPulledCardsToSeed(cards: CardRemoteState[]): number {
  type SeedCard = {
    id?: string;
    url?: string;
    categoria?: string | null;
    status?: string;
    lembrete?: string | null;
    criadoEm?: string | null;
  };
  type SeedNote = { flashcards?: SeedCard[] };

  let data: { notas?: SeedNote[] };
  try {
    data = JSON.parse(readFileSync(SEED_PATH, "utf8")) as { notas?: SeedNote[] };
  } catch {
    return 0;
  }

  const byKey = new Map<string, CardRemoteState>();
  for (const card of cards) {
    if (card.error) continue;
    const key = pageKeyFromUrl(card.url);
    if (key) byKey.set(key, card);
  }
  if (!byKey.size || !Array.isArray(data.notas)) return 0;

  let updated = 0;
  for (const note of data.notas) {
    if (!Array.isArray(note.flashcards)) continue;
    for (const card of note.flashcards) {
      const key = pageKeyFromUrl(card.url ?? "");
      const remote = key ? byKey.get(key) : undefined;
      if (!remote) continue;
      const status = normalizeStatus(remote.status) ?? "estudo";
      const categoria = normalizeCategoria(remote.categoria);
      const lembrete = remote.lembrete ?? null;
      const criadoEm = remote.criadoEm ?? card.criadoEm ?? null;
      if (
        (card.categoria ?? null) === categoria &&
        (card.status ?? "estudo") === status &&
        (card.lembrete ?? null) === lembrete &&
        (card.criadoEm ?? null) === criadoEm
      ) {
        continue;
      }
      card.categoria = categoria;
      card.status = status;
      card.lembrete = lembrete;
      if (criadoEm) card.criadoEm = criadoEm;
      updated += 1;
    }
  }

  if (updated) writeFileSync(SEED_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return updated;
}

export async function patchNotion(token: string, body: SyncBody): Promise<PatchResult> {
  const id = body.url ? pageId(body.url) : null;
  if (!id) return { ok: false, error: "URL Notion inválida" };

  const mark = normalizeCategoria(body.categoria);
  const categoria = mark ? categoriaToNotionShared(mark) : null;
  const status = statusToNotion(body.status);

  const properties: Record<string, unknown> = {};
  if (body.lembrete) {
    properties.Lembrete = { date: { start: body.lembrete } };
  }
  if (categoria) properties.Connaissance = { select: { name: categoria } };
  else if (body.categoria === null) properties.Connaissance = { select: null };
  if (status) properties.Status = { status: { name: status } };

  if (!Object.keys(properties).length) return { ok: true };

  const init: RequestInit = {
    method: "PATCH",
    headers: notionHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ properties }),
  };

  const { ok, response, detail } = await notionFetch(`https://api.notion.com/v1/pages/${id}`, init);
  if (ok) return { ok: true };

  // Só remove Status se a opção for mesmo inválida — nunca em rate limit.
  if (
    status === "Concluído" &&
    properties.Status &&
    isStatusOptionValidationError(response.status, detail)
  ) {
    const { Status: _status, ...withoutStatus } = properties;
    if (Object.keys(withoutStatus).length) {
      const retry = await notionFetch(`https://api.notion.com/v1/pages/${id}`, {
        ...init,
        body: JSON.stringify({ properties: withoutStatus }),
      });
      if (retry.ok) return { ok: true };
    }
  }

  return { ok: false, error: humanizeNotionError(response.status, detail) };
}

async function flushQueue(token: string): Promise<{ flushed: number; remaining: number }> {
  if (!token) return { flushed: 0, remaining: readQueue().length };
  const pending = readQueue();
  let flushed = 0;
  const kept: QueueItem[] = [];
  for (const item of pending) {
    const result = await patchNotion(token, item);
    if (result.ok) flushed += 1;
    else kept.push(item);
  }
  writeQueue(kept);
  return { flushed, remaining: kept.length };
}

export type SyncJsonResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Núcleo partilhado Vite + Vercel.
 * `useQueue`: fila em disco (dev local). Em serverless fica false.
 */
export async function runFlashcardSync(
  method: string,
  body: SyncBody | null,
  token: string,
  options?: { useQueue?: boolean; allowPersist?: boolean },
): Promise<SyncJsonResult> {
  const useQueue = options?.useQueue ?? false;
  const allowPersist = options?.allowPersist ?? false;

  if (method === "OPTIONS") return { status: 204, body: {} };

  if (method === "GET") {
    if (!useQueue) {
      return { status: 200, body: { pending: 0, flushed: 0, hasToken: Boolean(token) } };
    }
    const queue = await flushQueue(token);
    return { status: 200, body: { pending: queue.remaining, flushed: queue.flushed, hasToken: Boolean(token) } };
  }

  if (method !== "POST") {
    return { status: 405, body: { synced: false, error: "método inválido" } };
  }

  if (!body) {
    return { status: 400, body: { synced: false, error: "JSON inválido" } };
  }

  if (body.pull) {
    const urls = Array.isArray(body.urls) ? body.urls : body.url ? [body.url] : [];
    if (!urls.length) return { status: 400, body: { ok: false, error: "urls em falta" } };
    if (!token) return { status: 200, body: { ok: false, cards: [], error: "NOTION_TOKEN em falta" } };
    const cards = await pullNotionCards(token, urls);
    const persisted = allowPersist && body.persist ? persistPulledCardsToSeed(cards) : 0;
    return { status: 200, body: { ok: true, cards, persisted } };
  }

  if (!body.url || !pageId(body.url)) {
    return { status: 400, body: { synced: false, error: "URL Notion inválida" } };
  }

  if (useQueue) enqueue({ ...body, url: body.url });

  if (!token) {
    return { status: 200, body: { synced: false, queued: useQueue, error: "NOTION_TOKEN em falta" } };
  }

  const result = await patchNotion(token, body);
  if (result.ok) {
    if (useQueue) {
      dequeue(body.url);
      void flushQueue(token);
    }
    return {
      status: 200,
      body: {
        synced: true,
        lembrete: body.lembrete ?? null,
        categoria: body.categoria ?? null,
        status: body.status ?? null,
      },
    };
  }

  return { status: 200, body: { synced: false, queued: useQueue, error: result.error } };
}
