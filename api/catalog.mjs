/**
 * Índice leve BIBLECARDS + PLAN DE LECTURE BIBLIQUE.
 * GET /api/catalog?mode=index|full
 */
import {
  BIBLECARDS_DB,
  BIBLECARDS_PAGE_DB,
  PLAN_DB,
  PLAN_PAGE_DB,
  dateKey,
  normalizeCategoria,
  normalizeStatus,
  ensureLembrete,
  sleep,
  notionFetch,
  notionHeaders,
  categoriaPropFromPage,
  richTextToMarkdown,
  pageUuid,
  propDescriptionFull,
} from "../shared/notion.mjs";

function titleFromProp(prop) {
  const parts = prop?.title ?? prop?.rich_text ?? [];
  if (!Array.isArray(parts)) return "";
  return parts.map((t) => t.plain_text ?? "").join("").trim();
}

function richFromProp(prop) {
  if (!prop) return "";
  if (prop.type === "rich_text") return richTextToMarkdown(prop.rich_text).trim();
  if (Array.isArray(prop.rich_text)) return richTextToMarkdown(prop.rich_text).trim();
  return "";
}

function pageUrl(id) {
  const hex = String(id || "").replace(/-/g, "");
  return `https://app.notion.com/p/${hex}`;
}

function envSafe(name) {
  try {
    return typeof process !== "undefined" && process.env ? process.env[name] : undefined;
  } catch {
    return undefined;
  }
}

async function queryAll(token, databaseIds) {
  const ids = (Array.isArray(databaseIds) ? databaseIds : [databaseIds])
    .map((id) => pageUuid(String(id || "").replace(/-/g, "")) || String(id || "").trim())
    .filter(Boolean);
  const unique = [...new Set(ids)];
  let lastDetail = "";

  for (const databaseId of unique) {
    const endpoints = [
      `https://api.notion.com/v1/data_sources/${databaseId}/query`,
      `https://api.notion.com/v1/databases/${databaseId}/query`,
    ];
    for (const endpoint of endpoints) {
      const results = [];
      let cursor;
      let okEndpoint = true;
      do {
        const { ok, response, detail } = await notionFetch(endpoint, {
          method: "POST",
          headers: notionHeaders(token, { "Content-Type": "application/json" }),
          body: JSON.stringify({
            page_size: 100,
            start_cursor: cursor,
          }),
        });
        if (!ok) {
          lastDetail = detail || `Notion query ${response.status}`;
          okEndpoint = false;
          break;
        }
        const body = await response.json();
        results.push(...(body.results ?? []));
        cursor = body.has_more ? body.next_cursor : undefined;
        if (cursor) await sleep(120);
      } while (cursor);
      if (okEndpoint) return results;
    }
  }
  throw new Error(lastDetail || "Notion query failed");
}

async function fetchBlocksPlain(token, pageId) {
  const lines = [];
  let cursor;
  do {
    const q = cursor ? `?start_cursor=${encodeURIComponent(cursor)}&page_size=100` : "?page_size=100";
    const { ok, response } = await notionFetch(`https://api.notion.com/v1/blocks/${pageId}/children${q}`, {
      method: "GET",
      headers: notionHeaders(token),
    });
    if (!ok) break;
    const body = await response.json();
    for (const block of body.results ?? []) {
      const type = block.type;
      const data = block[type];
      if (!data) continue;
      const rich = data.rich_text;
      if (Array.isArray(rich) && rich.length) {
        const text = richTextToMarkdown(rich).trim();
        if (text) lines.push(text);
      }
    }
    cursor = body.has_more ? body.next_cursor : undefined;
    if (cursor) await sleep(80);
  } while (cursor);
  return lines.join("\n");
}

export function parsePlanDays(raw) {
  const text = String(raw || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "");
  const days = [];
  const jourRe =
    /(?:^|\n)\s*[•*]?\s*Jour\s+(\d+)\s*[:：]\s*([^\n]*)([\s\S]*?)(?=(?:\n\s*[•*]?\s*Jour\s+\d+\s*[:：])|$)/gi;
  let match;
  while ((match = jourRe.exec(text))) {
    const jour = Number(match[1]);
    const title = (match[2] || "").trim();
    const body = match[3] || "";
    const texteMatch = body.match(/Texte\s*:\s*([^\n]+)/i);
    const defiMatch = body.match(/Défi\s*:\s*([\s\S]+?)(?=\n\s*[•*]?\s*Jour\s+\d+|$)/i);
    let texte = texteMatch ? texteMatch[1].trim() : "";
    let defi = defiMatch ? defiMatch[1].trim() : body.trim();
    if (!texte && title) texte = title;
    if (texte || defi) days.push({ jour, texte, defi: defi.replace(/\n+/g, " ").trim() });
  }
  if (days.length) return days.sort((a, b) => a.jour - b.jour);

  // Plan [extration ia] compact: 1**Ésaïe 6:1-8**Focus2**…
  const compactRe =
    /(\d{1,2})\s*\*\*([^*]+)\*\*\s*([\s\S]*?)(?=(?:\d{1,2}\s*\*\*)|Question de méditation|Semaine|Comment utiliser|$)/gi;
  while ((match = compactRe.exec(text))) {
    const jour = Number(match[1]);
    if (jour < 1 || jour > 40) continue;
    days.push({
      jour,
      texte: match[2].trim(),
      defi: match[3].replace(/\s+/g, " ").trim(),
    });
  }
  if (days.length) return days.sort((a, b) => a.jour - b.jour);

  const tableRe = /(?:^|\n)(\d{1,2})\s+([^\n]+?)(?=\n\d{1,2}\s+|\nQuestion|\nSemaine|\nComment|$)/g;
  while ((match = tableRe.exec(text))) {
    const jour = Number(match[1]);
    if (jour < 1 || jour > 40) continue;
    const rest = match[2].trim();
    const split = rest.match(/^(.+?)([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ].+)$/);
    days.push({
      jour,
      texte: split ? split[1].trim() : rest,
      defi: split ? split[2].trim() : "",
    });
  }
  return days.sort((a, b) => a.jour - b.jour);
}

function mapCardPage(page, bodyText = "") {
  const props = page.properties ?? {};
  const id = page.id;
  const nom = titleFromProp(props.Nom) || "Carte";
  const category = props.Category?.select?.name ?? null;
  const connaissance = props.Connaissance?.select?.name ?? null;
  const catProp = categoriaPropFromPage(props);
  const categoria =
    normalizeCategoria(connaissance) ?? normalizeCategoria(catProp?.select?.name);
  const status = normalizeStatus(props.Status?.status?.name) ?? "espera";
  const lembreteRaw = props.Lembrete?.date?.start ?? null;
  const criadoEm = props["Criado em"]?.created_time || page.created_time || null;
  const lembrete =
    lembreteRaw?.slice(0, 10) ?? ensureLembrete({ status, lembrete: null, criadoEm });

  const heading = bodyText.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
  const rawFrente = heading || (nom !== "CARDS" ? nom : category || "Carte");
  const frente =
    String(category || "").toUpperCase() === "VERSECARD"
      ? String(rawFrente).trim().toUpperCase()
      : rawFrente;
  const verso = bodyText.trim() || frente;

  return {
    id: `card-${String(id).replace(/-/g, "").slice(0, 16)}`,
    frente,
    verso,
    categoria,
    status,
    url: pageUrl(id),
    lembrete,
    cardCategory: category,
    connaissance,
    criadoEm: criadoEm ? dateKey(criadoEm) : null,
  };
}

function findProp(props, ...names) {
  if (!props || typeof props !== "object") return null;
  for (const name of names) {
    if (props[name]) return props[name];
  }
  const keys = Object.keys(props);
  for (const name of names) {
    const needle = String(name).toLowerCase();
    const hit = keys.find((key) => key.toLowerCase() === needle || key.toLowerCase().startsWith(`${needle} `) || key.toLowerCase().startsWith(`${needle}[`));
    if (hit) return props[hit];
  }
  return null;
}

function themeFromProp(prop) {
  if (!prop) return "";
  if (prop.type === "select") return String(prop.select?.name ?? "").trim();
  if (prop.type === "multi_select") {
    return (prop.multi_select ?? []).map((o) => o.name).filter(Boolean).join(", ");
  }
  return richFromProp(prop).replace(/\*\*/g, "").trim();
}

function mapPlanPage(page, bodyText = "", planProp = "", description = "") {
  const props = page.properties ?? {};
  const id = page.id;
  const nome = titleFromProp(props.Nome) || "Plan";
  const theme = themeFromProp(findProp(props, "Thème", "Theme")) || nome;
  const planField = richFromProp(findProp(props, "Plan", "Plan [extration ia]")) || planProp;
  const descriptionField =
    description || richFromProp(findProp(props, "Description")).trim();
  const days = parsePlanDays(bodyText);
  const merged = days.length ? days : parsePlanDays(`${bodyText}\n${planField}`);
  return {
    id: `plan-${String(id).replace(/-/g, "").slice(0, 16)}`,
    nome,
    theme,
    url: pageUrl(id),
    days: merged,
    description: descriptionField,
    criadoEm: page.created_time ? dateKey(page.created_time) : null,
  };
}


export function cardsToSeeds(cards) {
  const groups = new Map();
  for (const card of cards) {
    const key = card.cardCategory || "ALL";
    if (!groups.has(key)) {
      groups.set(key, {
        nota: {
          id: `bucket-${String(key).toLowerCase()}`,
          titulo: key,
          url: "",
          criadoEm: card.criadoEm || dateKey(new Date()),
          cartoes: 0,
        },
        materia: { id: `cat-${String(key).toLowerCase()}`, nome: key },
        disciplina: { id: `disc-${String(key).toLowerCase()}`, nome: key },
        flashcards: [],
      });
    }
    groups.get(key).flashcards.push(card);
  }
  for (const seed of groups.values()) {
    seed.nota.cartoes = seed.flashcards.length;
  }
  return [...groups.values()];
}

export async function buildCatalog(token, { full = false } = {}) {
  const cardsDb = [
    envSafe("NOTION_BIBLECARDS_DB"),
    BIBLECARDS_DB,
    BIBLECARDS_PAGE_DB,
  ].filter(Boolean);
  const planDb = [envSafe("NOTION_PLAN_DB"), PLAN_DB, PLAN_PAGE_DB].filter(Boolean);

  let cardPages = [];
  let planPages = [];
  try {
    cardPages = await queryAll(token, cardsDb);
  } catch (err) {
    console.warn("[catalog] BIBLECARDS:", err instanceof Error ? err.message : err);
  }
  try {
    planPages = await queryAll(token, planDb);
  } catch (err) {
    console.warn("[catalog] PLAN:", err instanceof Error ? err.message : err);
  }

  const cards = [];
  for (const page of cardPages) {
    let body = "";
    if (full) {
      body = await fetchBlocksPlain(token, page.id);
      await sleep(80);
    }
    cards.push(mapCardPage(page, body));
  }

  const verseCards = cards.filter(
    (card) => String(card.cardCategory || "").toUpperCase() === "VERSECARD",
  );

  const plans = [];
  for (const page of planPages) {
    let body = "";
    if (full) {
      body = await fetchBlocksPlain(token, page.id);
      await sleep(80);
    }
    const planProp = richFromProp(findProp(page.properties, "Plan", "Plan [extration ia]"));
    // Description = Resumo do StudyOS: ler completo (paginado) sempre que possível.
    let description = "";
    try {
      description = await propDescriptionFull(token, page.id, page.properties ?? {});
      await sleep(80);
    } catch {
      description = richFromProp(findProp(page.properties, "Description"));
    }
    plans.push(mapPlanPage(page, body, planProp, description));
  }

  return {
    notas: cardsToSeeds(verseCards),
    plans,
    cardCount: verseCards.length,
    planCount: plans.length,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "méthode invalide" });
      return;
    }

    const token = envSafe("NOTION_TOKEN") || "";
    const url = new URL(req.url || "/", "http://localhost");
    const mode = url.searchParams.get("mode") || "index";
    const full = mode === "full";

    if (!token) {
      res.status(200).json({
        ok: false,
        error: "NOTION_TOKEN em falta",
        hasToken: false,
        notas: [],
        plans: [],
      });
      return;
    }

    const catalog = await buildCatalog(token, { full });
    res.status(200).json({ ok: true, hasToken: true, ...catalog });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
}
