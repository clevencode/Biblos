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

/**
 * Propriedade rich_text completa (paginada).
 * A API Notion trunca rich_text nas páginas (~2000 chars).
 * Inline curto → completo; inline longo → paginar com limite de segurança.
 */
export async function propRichTextFull(token, pageId, props, propName) {
  const p = props?.[propName];
  const inline = resumoFromProp(p);
  const propId = String(p?.id ?? "");
  // Notion corta ~2000 chars no objeto página — abaixo disso o inline basta.
  if (!propId || inline.length < 1900) return inline;
  try {
    const segments = [];
    let cursor;
    let pages = 0;
    const maxPages = 40;
    do {
      pages += 1;
      const encodedId = encodeURIComponent(propId);
      const q = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : "";
      const body = await notionGet(token, `/pages/${pageId}/properties/${encodedId}${q}`);
      if (body.object === "list") {
        for (const item of body.results ?? []) {
          const itemType = String(item.type ?? "");
          if (itemType === "rich_text" && item.rich_text) {
            segments.push(item.rich_text);
          } else if (itemType === "text" && item.text) {
            const text = typeof item.text === "string" ? item.text : item.text?.content;
            if (text) segments.push({ plain_text: text, annotations: {} });
          } else if (typeof item.plain_text === "string" && item.plain_text) {
            segments.push({ plain_text: item.plain_text, annotations: {} });
          }
        }
        const next = body.has_more ? body.next_cursor : null;
        // Évite boucle infinie si le curseur ne avance pas
        cursor = next && next !== cursor ? next : undefined;
        continue;
      }
      if (body.type === "rich_text") return richTextToMarkdown(body.rich_text).trim() || inline;
      if (body.type === "text") {
        const text =
          typeof body.text === "string" ? body.text : body.text?.content || "";
        return String(text).trim() || inline;
      }
      break;
    } while (cursor && pages < maxPages);
    const full = richTextToMarkdown(segments).trim();
    return full.length >= inline.length ? full : inline;
  } catch {
    return inline;
  }
}

/** Resolve le nom réel de la propriété Notion. */
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

/** Description du PLAN DE LECTURE (intro) — pas Note. */
export async function propDescriptionFull(token, pageId, props) {
  const name = resolveRichTextPropName(props, "Description", "Devotional");
  if (!name || !props?.[name]) return "";
  return propRichTextFull(token, pageId, props, name);
}

/**
 * Propriété Plan (jours + étapes) — souvent > 2000 chars ;
 * ex. « Plan [extration ia] ».
 */
export async function propPlanFull(token, pageId, props) {
  const name = resolveRichTextPropName(props, "Plan", "Plan [extration ia]");
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

/** Sync da propriedade Description (PLAN DE LECTURE) — intro do plano. */
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

function notionPageUrl(id) {
  return `https://www.notion.so/${String(id).replace(/-/g, "")}`;
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

/* —— Notifications (mises à jour app → onglet Notifications) —— */

export function notificationsDatabaseId() {
  return env("NOTION_NOTIFICATIONS_DB", "5d217d65-b106-46f6-8ddc-c86ff7197e30");
}

function plainFromProp(prop) {
  if (!prop || typeof prop !== "object") return "";
  if (prop.type === "title" && Array.isArray(prop.title)) {
    return prop.title.map((s) => s?.plain_text ?? "").join("").trim();
  }
  if (prop.type === "rich_text" && Array.isArray(prop.rich_text)) {
    return prop.rich_text.map((s) => s?.plain_text ?? "").join("").trim();
  }
  if (prop.type === "select") return String(prop.select?.name ?? "").trim();
  if (prop.type === "checkbox") return Boolean(prop.checkbox);
  if (prop.type === "date") return String(prop.date?.start ?? "").trim();
  return "";
}

/**
 * Liste les notifications publiées (Published=true) pour le fil in-app.
 */
export async function listPublishedNotifications(token, { limit = 40 } = {}) {
  if (!token) {
    return { ok: false, error: "NOTION_TOKEN em falta", hasToken: false, items: [] };
  }
  const databaseId = notificationsDatabaseId();
  if (!databaseId) {
    return { ok: false, error: "NOTION_NOTIFICATIONS_DB em falta", hasToken: true, items: [] };
  }

  const parents = [
    databaseId,
    "5d217d65b10646f68ddcc86ff7197e30",
    "6fd374ac-1d14-4eb0-9a67-33839434e512",
  ].filter((id, i, arr) => id && arr.indexOf(id) === i);

  let lastError = "";
  for (const database_id of parents) {
    const queried = await notionFetch(
      `https://api.notion.com/v1/databases/${database_id}/query`,
      {
        method: "POST",
        headers: notionHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          page_size: Math.min(100, Math.max(1, limit)),
          filter: {
            property: "Published",
            checkbox: { equals: true },
          },
          sorts: [{ property: "PublishedAt", direction: "descending" }],
        }),
      },
    );
    if (!queried.ok) {
      lastError = humanizeCreateError(queried.response?.status ?? 0, queried.detail);
      continue;
    }
    const data = await queried.response.json();
    const items = (data.results || []).map((page) => {
      const props = page.properties || {};
      const body = plainFromProp(props.Body) || "";
      const kindRaw = plainFromProp(props.Kind) || "Actualité";
      const publishedAt =
        plainFromProp(props.PublishedAt) ||
        page.created_time ||
        new Date().toISOString();
      const kind = /mise|update|annonce/i.test(kindRaw) ? "system" : "info";
      const name = plainFromProp(props.Name) || "";
      return {
        id: page.id,
        title: name || kindRaw,
        body,
        kind,
        kindLabel: kindRaw,
        at: publishedAt,
        url: page.url || notionPageUrl(page.id),
      };
    });
    return { ok: true, hasToken: true, items };
  }

  return {
    ok: false,
    hasToken: true,
    items: [],
    error: lastError || "Impossible de lire Notifications",
  };
}
