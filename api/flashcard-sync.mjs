/**
 * Produção (Vercel + Capacitor): StudyOS → Notion.
 * Ficheiro .mjs autónomo — evita crash ESM/`type:module` com api/*.ts.
 * Requer NOTION_TOKEN nas Environment Variables do projecto Vercel.
 */
import {
  pageId,
  dateKey,
  normalizeCategoria,
  normalizeStatus,
  categoriaToNotion,
  statusToNotion,
  categoriaPropFromPage,
  ensureLembrete,
  sleep,
  notionFetch,
  notionHeaders,
  isStatusOptionValidationError,
} from "../shared/notion.mjs";

function humanizeNotionError(statusCode, detail) {
  const lower = String(detail || "").toLowerCase();
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
  if (lower.includes("validation_error") && (lower.includes("categoria") || lower.includes("select") || lower.includes("connaissance"))) {
    return "Notion: opção de Repetition inválida";
  }
  if (statusCode === 404) return "Notion: página do cartão não encontrada";
  try {
    const parsed = JSON.parse(detail);
    if (parsed?.message) return `Notion ${statusCode}: ${String(parsed.message).slice(0, 140)}`;
  } catch {
    /* texto bruto */
  }
  const short = String(detail || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return short ? `Notion ${statusCode}: ${short}` : `Notion ${statusCode}`;
}

async function fetchNotionCard(token, url) {
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

  const page = await response.json();
  const props = page.properties ?? {};
  const catProp = categoriaPropFromPage(props);
  const categoriaRaw = catProp?.select?.name ?? null;
  const statusRaw = props.Status?.status?.name ?? null;
  const lembreteRaw = props.Lembrete?.date?.start ?? null;
  const criadoEm = props["Criado em"]?.created_time || page.created_time || null;
  const status = normalizeStatus(statusRaw);
  const lembrete =
    lembreteRaw?.slice(0, 10) ??
    ensureLembrete({
      status: status ?? "estudo",
      lembrete: null,
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

async function pullNotionCards(token, urls) {
  const unique = [...new Set(urls.filter((item) => pageId(item)))];
  const concurrency = 2;
  const out = new Array(unique.length);
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

async function patchNotion(token, body) {
  const id = body.url ? pageId(body.url) : null;
  if (!id) return { ok: false, error: "URL Notion inválida" };

  const mark = normalizeCategoria(body.categoria);
  const categoria = mark ? categoriaToNotion(mark) : null;
  const status = statusToNotion(body.status);

  const properties = {};
  if (body.lembrete) properties.Lembrete = { date: { start: body.lembrete } };
  if (categoria) properties.Repetition = { select: { name: categoria } };
  else if (body.categoria === null) properties.Repetition = { select: null };
  if (status) properties.Status = { status: { name: status } };

  if (!Object.keys(properties).length) return { ok: true };

  const init = {
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

export default async function handler(req, res) {
  try {
    const token = process.env.NOTION_TOKEN || "";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (method === "GET") {
      res.status(200).json({ pending: 0, flushed: 0, hasToken: Boolean(token) });
      return;
    }

    if (method !== "POST") {
      res.status(405).json({ synced: false, error: "método inválido" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    if (body.pull) {
      const urls = Array.isArray(body.urls) ? body.urls : body.url ? [body.url] : [];
      if (!urls.length) {
        res.status(400).json({ ok: false, error: "urls em falta" });
        return;
      }
      if (!token) {
        res.status(200).json({ ok: false, cards: [], error: "NOTION_TOKEN em falta" });
        return;
      }
      const cards = await pullNotionCards(token, urls);
      res.status(200).json({ ok: true, cards, persisted: 0 });
      return;
    }

    if (!body.url || !pageId(body.url)) {
      res.status(400).json({ synced: false, error: "URL Notion inválida" });
      return;
    }

    if (!token) {
      res.status(200).json({ synced: false, queued: false, error: "NOTION_TOKEN em falta" });
      return;
    }

    const result = await patchNotion(token, body);
    if (result.ok) {
      res.status(200).json({
        synced: true,
        lembrete: body.lembrete ?? null,
        categoria: body.categoria ?? null,
        status: body.status ?? null,
      });
      return;
    }

    res.status(200).json({ synced: false, queued: false, error: result.error });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
}
