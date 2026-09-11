/**
 * Núcleo Notion partilhado: api/*.mjs, server/*.ts, scripts/*.mjs e src/.
 * Uma só implementação — evita drift entre Vercel, Vite e CLI.
 */

export const NOTION_VERSION = "2022-06-28";

export function pageIdFromNotionUrl(urlOrId) {
  const raw = String(urlOrId || "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  const slug = raw.split("/").pop()?.split("?")[0] ?? "";
  // Aceita "PLAN-3d203af9…" / "Titulo-abc…" — extrai os 32 hex finais
  const compact = slug.replace(/-/g, "");
  const hexTail = compact.match(/([0-9a-f]{32})$/i)?.[1];
  const hex = hexTail || compact.replace(/^p/i, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Alias usado nos handlers de cartões. */
export function pageId(url) {
  return pageIdFromNotionUrl(url);
}

export function pageUuid(hex32) {
  const hex = String(hex32 || "").replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function dateKey(value) {
  if (typeof value === "string") {
    const isoDay = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDay) return isoDay[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function env(name, fallback = "") {
  try {
    if (typeof process !== "undefined" && process.env && process.env[name]) {
      return process.env[name];
    }
  } catch {
    /* browser */
  }
  return fallback;
}

/** IDs das DBs Biblos (data source / collection — override via env no servidor). */
export const BIBLECARDS_DB = env("NOTION_BIBLECARDS_DB", "903652b8-bfa0-4899-90fd-590837d6eb2f");
export const PLAN_DB = env("NOTION_PLAN_DB", "3d103af9-2e96-80c4-bcdd-000bd60ac72f");
/** Page ids das databases (fallback REST legacy). */
export const BIBLECARDS_PAGE_DB = "62c1d60c-b1dc-4e01-aa06-722deceda17c";
export const PLAN_PAGE_DB = "3d103af9-2e96-8002-bd85-d4598aec336f";

export function normalizeCategoria(value) {
  if (!value) return null;
  const key = String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  // Repetition Anki (Biblos) + Connaissance / Catégorie legado
  // UI : Peu · Moyenne · Facile (clés internes encore · medio · facil)
  if (
    key === "encore" ||
    key === "again" ||
    key === "de nouveau" ||
    key === "peu"
  ) {
    return "encore";
  }
  if (key === "facil" || key === "facile" || key === "easy" || key === "connu" || key === "eleve") {
    return "facil";
  }
  if (key === "medio" || key === "moyen" || key === "moyenne" || key === "correct" || key === "good") {
    return "medio";
  }
  if (
    key === "dificil" ||
    key === "dificile" ||
    key === "difficile" ||
    key === "hard" ||
    key === "desconhecido"
  ) {
    return "dificil";
  }
  return null;
}

export function normalizeStatus(value) {
  if (!value) return null;
  const key = String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  // FR (plano) + PT Notion default + StudyOS legado
  if (key === "estudo" || key === "etude" || key === "em andamento") return "estudo";
  if (key === "espera" || key === "attente" || key === "nao iniciada") return "espera";
  if (key === "encerrado" || key === "termine" || key === "concluido") return "encerrado";
  return null;
}

/**
 * Repetition : Peu | Moyenne | Facile (UI).
 * Notion conserve Encore | Correct | Facile (+ Dificile legacy).
 */
export function categoriaToNotion(categoria) {
  if (categoria === "encore") return "Encore";
  if (categoria === "dificil") return "Dificile";
  if (categoria === "medio") return "Correct";
  if (categoria === "facil") return "Facile";
  return null;
}

/**
 * Status no BIBLECARDS (opções Notion por defeito após ADD COLUMN STATUS).
 * UI FR mapeia Étude/Attente/Terminé ↔ estes nomes.
 */
export function statusToNotion(status) {
  if (status === "estudo") return "Em andamento";
  if (status === "espera") return "Não iniciada";
  if (status === "encerrado") return "Concluído";
  return null;
}

/** Propriedade select SRS: Repetition (Anki) puis Connaissance / Catégorie. */
export function categoriaPropFromPage(props) {
  return (
    props?.Repetition ??
    props?.Répétition ??
    props?.Connaissance ??
    props?.Catégorie ??
    props?.Categoria ??
    null
  );
}

/** Lembrete padrão: espera = dia de criação; estudo = criação + 2 dias. */
export function ensureLembrete({ status, lembrete, criadoEm }, today = dateKey(new Date())) {
  if (status === "encerrado") return lembrete ? String(lembrete).slice(0, 10) : null;
  if (lembrete) return String(lembrete).slice(0, 10);
  const base = criadoEm ? dateKey(criadoEm) : today;
  if (status === "espera") return base || today;
  const date = new Date(`${base || today}T00:00:00`);
  date.setDate(date.getDate() + 2);
  return dateKey(date);
}

function formatRichSegment(seg) {
  let text = seg?.plain_text ?? "";
  if (!text) return "";
  const a = seg.annotations ?? {};
  if (a.code) text = `\`${text.replace(/`/g, "\\`")}\``;
  else {
    if (a.strikethrough) text = `~~${text}~~`;
    if (a.italic) text = `*${text}*`;
    if (a.bold) text = `**${text}**`;
  }
  if (a.underline) text = `<u>${text}</u>`;
  if (seg.href) text = `[${text}](${seg.href})`;
  return text;
}

/** Segmentos rich_text → markdown leve (mesma junção do StudyOS / propriedade Notion). */
export function richTextToMarkdown(segments) {
  if (!Array.isArray(segments)) {
    if (segments && typeof segments === "object" && "plain_text" in segments) {
      return formatRichSegment(segments);
    }
    return "";
  }
  return segments.map(formatRichSegment).join("");
}

export function resumoFromProp(p) {
  if (!p) return "";
  if (p.type === "rich_text") return richTextToMarkdown(p.rich_text).trim();
  if (p.type === "text") {
    if (typeof p.text === "string") return p.text.trim();
    return richTextToMarkdown(p.text).trim();
  }
  return "";
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function notionHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    ...extra,
  };
}

/** Notion ~3 req/s; em 429 espera Retry-After (ou backoff) antes de repetir. */
export async function notionFetch(url, init, retries = 4) {
  let lastResponse = null;
  let lastDetail = "";
  for (let attempt = 0; attempt < retries; attempt += 1) {
    let response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha de rede";
      const cause =
        error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
      lastDetail = `network_error: ${message}${cause}`;
      lastResponse = new Response(lastDetail, { status: 503, statusText: "Network Error" });
      if (attempt < retries - 1) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      return { ok: false, response: lastResponse, detail: lastDetail };
    }
    if (response.ok) return { ok: true, response, detail: "" };
    const detail = await response.text().catch(() => "");
    lastResponse = response;
    lastDetail = detail;
    if (response.status === 429 && attempt < retries - 1) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }
    return { ok: false, response, detail };
  }
  return { ok: false, response: lastResponse, detail: lastDetail };
}

export async function notionGet(token, path) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method: "GET",
    headers: notionHeaders(token),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Notion ${response.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

export async function propResumoFull(token, pageId, props) {
  return propRichTextFull(token, pageId, props, "Resumo");
}

/** Propriedade rich_text longa (paginada) — Devotional / Description / Resumo. */
export async function propRichTextFull(token, pageId, props, propName) {
  const p = props?.[propName];
  const inline = resumoFromProp(p);
  if (inline) return inline;
  const propId = String(p?.id ?? "");
  if (!propId) return "";
  try {
    const segments = [];
    let cursor;
    do {
      const q = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : "";
      const body = await notionGet(token, `/pages/${pageId}/properties/${propId}${q}`);
      if (body.object === "list") {
        for (const item of body.results ?? []) {
          const itemType = String(item.type ?? "");
          if (itemType === "rich_text" && item.rich_text) {
            segments.push(item.rich_text);
          } else if (typeof item.plain_text === "string" && item.plain_text) {
            segments.push({ plain_text: item.plain_text, annotations: {} });
          }
        }
        cursor = body.has_more ? body.next_cursor : undefined;
        continue;
      }
      if (body.type === "rich_text") return richTextToMarkdown(body.rich_text).trim();
      break;
    } while (cursor);
    return richTextToMarkdown(segments).trim();
  } catch {
    return "";
  }
}

/** Resolve le nom réel de la propriété Notion (Devotional prioritaire). */
function resolveRichTextPropName(props, ...candidates) {
  const keys = Object.keys(props ?? {});
  for (const name of candidates) {
    const needle = String(name).toLowerCase();
    const hit = keys.find(
      (key) =>
        key.toLowerCase() === needle ||
        key.toLowerCase().startsWith(`${needle} `) ||
        key.toLowerCase().startsWith(`${needle}[`),
    );
    if (hit) return hit;
  }
  return candidates[0] || null;
}

/** Devotional (ex-Description) du PLAN DE LECTURE. */
export async function propDescriptionFull(token, pageId, props) {
  const name = resolveRichTextPropName(props, "Devotional", "Description");
  if (!name || !props?.[name]) return "";
  return propRichTextFull(token, pageId, props, name);
}

export async function fetchNotionResumo(token, urlOrId) {
  if (!token) {
    return { ok: false, error: "NOTION_TOKEN em falta", hasToken: false, resumo: "" };
  }
  const id =
    pageIdFromNotionUrl(urlOrId) ||
    (/^[0-9a-f-]{32,36}$/i.test(String(urlOrId || "").trim()) ? String(urlOrId).trim() : null);
  if (!id) {
    return { ok: false, error: "url ou pageId inválido", hasToken: true, resumo: "" };
  }
  try {
    const page = await notionGet(token, `/pages/${id}`);
    const resumo = await propResumoFull(token, id, page.properties ?? {});
    return { ok: true, pageId: id, resumo, hasToken: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, hasToken: true, resumo: "", pageId: id };
  }
}

/** Sync da propriedade Devotional (PLAN DE LECTURE) — equivalente a Resumo no StudyOS. */
export async function fetchNotionDescription(token, urlOrId) {
  if (!token) {
    return { ok: false, error: "NOTION_TOKEN em falta", hasToken: false, description: "" };
  }
  const id =
    pageIdFromNotionUrl(urlOrId) ||
    (/^[0-9a-f-]{32,36}$/i.test(String(urlOrId || "").trim()) ? String(urlOrId).trim() : null);
  if (!id) {
    return { ok: false, error: "url ou pageId inválido", hasToken: true, description: "" };
  }
  try {
    const page = await notionGet(token, `/pages/${id}`);
    const description = await propDescriptionFull(token, id, page.properties ?? {});
    return { ok: true, pageId: id, description, hasToken: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, hasToken: true, description: "", pageId: id };
  }
}


export function isStatusOptionValidationError(statusCode, detail) {
  if (statusCode === 429 || statusCode === 401 || statusCode === 403) return false;
  const lower = String(detail || "").toLowerCase();
  if (lower.includes("rate_limited") || lower.includes("rate limited")) return false;
  return (
    lower.includes("encerrado") ||
    lower.includes("is not a valid status") ||
    lower.includes("status is invalid") ||
    (lower.includes("validation_error") && lower.includes('"status"') && lower.includes("option"))
  );
}

/** Notes Notion — override com NOTION_NOTES_DB (servidor). */
export function notesDatabaseId() {
  return env("NOTION_NOTES_DB", "c3815294-294c-48e3-81d7-784d47981e5f");
}

function notionPageUrl(id) {
  return `https://www.notion.so/${String(id).replace(/-/g, "")}`;
}

function bibleCardsParentIds() {
  const ids = [
    env("NOTION_BIBLECARDS_DB", ""),
    BIBLECARDS_DB,
    BIBLECARDS_PAGE_DB,
  ].filter(Boolean);
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function humanizeCreateError(statusCode, detail) {
  let message = String(detail || "");
  try {
    const parsed = JSON.parse(message);
    if (parsed?.message) message = String(parsed.message);
  } catch {
    /* raw */
  }
  const lower = message.toLowerCase();
  if (statusCode === 404 || lower.includes("could not find database")) {
    return (
      "Notion: base BIBLECARDS introuvable pour l’intégration. " +
      "Partage la database BIBLECARDS avec l’intégration du NOTION_TOKEN (.env)."
    );
  }
  if (statusCode === 401 || statusCode === 403) {
    return "Notion: token sans permission sur BIBLECARDS";
  }
  return `Notion ${statusCode}: ${message.replace(/\s+/g, " ").trim().slice(0, 180)}`;
}

/**
 * Cria VERSECARD em BIBLECARDS (Notion).
 * Tenta data-source id + page id da database (env NOTION_BIBLECARDS_DB).
 */
export async function createVerseCard(token, input = {}) {
  const title = String(input.frente || "")
    .trim()
    .toUpperCase();
  const body = String(input.verso || "").trim();
  const localId = input.localId ? String(input.localId) : null;
  if (!token) {
    return { ok: false, error: "NOTION_TOKEN em falta", hasToken: false };
  }
  if (!title || !body) {
    return { ok: false, error: "frente ou verso em falta", hasToken: true };
  }

  const lembrete =
    (input.lembrete && String(input.lembrete).slice(0, 10)) ||
    ensureLembrete({
      status: input.status || "espera",
      lembrete: null,
      criadoEm: dateKey(new Date()),
    });
  const statusName = statusToNotion(input.status || "espera") || "Não iniciada";
  const repetition = categoriaToNotion(input.categoria);

  const properties = {
    Nom: { title: [{ type: "text", text: { content: title.slice(0, 2000) } }] },
    Category: { select: { name: "VERSECARD" } },
    Status: { status: { name: statusName } },
    Lembrete: { date: { start: lembrete } },
  };
  if (repetition) {
    properties.Repetition = { select: { name: repetition } };
  }

  const children = [];
  let rest = body.slice(0, 8000);
  while (rest.length) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: rest.slice(0, 1900) } }],
      },
    });
    rest = rest.slice(1900);
  }

  const parents = bibleCardsParentIds();
  if (!parents.length) {
    return { ok: false, error: "NOTION_BIBLECARDS_DB em falta", hasToken: true };
  }

  let lastError = "création Notion échouée";
  for (const database_id of parents) {
    const { ok, response, detail } = await notionFetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        parent: { database_id },
        properties,
        children,
      }),
    });

    if (!ok) {
      lastError = humanizeCreateError(response?.status ?? 0, detail);
      continue;
    }

    const page = await response.json();
    const id = page.id;
    const criadoEm = page.created_time ? dateKey(page.created_time) : dateKey(new Date());
    return {
      ok: true,
      hasToken: true,
      localId,
      card: {
        id: localId || `card-${String(id).replace(/-/g, "").slice(0, 16)}`,
        frente: title,
        verso: body,
        categoria: input.categoria ?? null,
        status: input.status || "espera",
        url: notionPageUrl(id),
        lembrete,
        cardCategory: "VERSECARD",
        criadoEm,
      },
    };
  }

  return { ok: false, error: lastError, hasToken: true };
}

/** Archive une page VERSECARD (suppression manuelle dans Biblos). */
export async function archiveVerseCard(token, urlOrId) {
  if (!token) {
    return { ok: false, error: "NOTION_TOKEN em falta", hasToken: false };
  }
  const id = pageIdFromNotionUrl(urlOrId);
  if (!id) {
    return { ok: false, error: "pageId invalide", hasToken: true };
  }
  const { ok, response, detail } = await notionFetch(`https://api.notion.com/v1/pages/${id}`, {
    method: "PATCH",
    headers: notionHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ archived: true }),
  });
  if (!ok) {
    return {
      ok: false,
      hasToken: true,
      error: humanizeCreateError(response?.status ?? 0, detail),
    };
  }
  return { ok: true, hasToken: true };
}
