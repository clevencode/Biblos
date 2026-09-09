/**
 * Sincroniza Categoria / Lembrete / Status entre Notion e seed.json.
 *
 * Notion → StudyOS (padrão):
 *   node scripts/sync-flashcards.mjs --dry-run
 *   node scripts/sync-flashcards.mjs --apply
 *
 * StudyOS → Notion (push a partir do seed):
 *   node scripts/sync-flashcards.mjs --push --dry-run
 *   node scripts/sync-flashcards.mjs --push --apply
 *
 * Opções: --limit=N
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "vite";
import {
  normalizeCategoria,
  normalizeStatus,
  categoriaToNotion,
  pageUuid,
  sleep,
  notionHeaders,
} from "../shared/notion.mjs";

const CARDS_DB = "cb1e0098-7dca-417b-b03b-478601d76d0b";
const SEED = join(process.cwd(), "src", "data", "seed.json");
const DELAY_MS = 120;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");
const push = args.has("--push");
const limit = Number([...args].find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || 0;

const token = loadEnv("development", process.cwd(), "").NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN ausente no .env");
  process.exit(1);
}

const headers = notionHeaders(token, { "Content-Type": "application/json" });

async function notion(path, init = {}, retries = 4) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`https://api.notion.com/v1${path}`, {
        ...init,
        headers: { ...headers, ...init.headers },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        await sleep(1000 * (i + 1));
        continue;
      }
      if (!res.ok) {
        throw new Error(
          `${init.method || "GET"} ${path} → ${res.status}: ${body.message || JSON.stringify(body)}`,
        );
      }
      return body;
    } catch (err) {
      lastErr = err;
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

function pageKey(value) {
  const raw = String(value || "")
    .trim()
    .split("/")
    .pop()
    ?.split("?")[0]
    ?.replace(/-/g, "")
    .replace(/^p/i, "")
    .toLowerCase();
  return raw && /^[0-9a-f]{32}$/.test(raw) ? raw : "";
}

function statusToNotion(status) {
  if (status === "estudo") return "Estudo";
  if (status === "espera") return "Espera";
  if (status === "encerrado") return "Encerrado";
  return null;
}

function readLembrete(page) {
  const start = page.properties?.Lembrete?.date?.start;
  return start ? String(start).slice(0, 10) : null;
}

function readRemote(page) {
  return {
    key: pageKey(page.id),
    categoria: normalizeCategoria(page.properties?.Categoria?.select?.name),
    status: normalizeStatus(page.properties?.Status?.status?.name) ?? "estudo",
    lembrete: readLembrete(page),
  };
}

async function queryAllCards() {
  const out = [];
  let cursor;
  do {
    const body = await notion(`/databases/${CARDS_DB}/query`, {
      method: "POST",
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    out.push(...(body.results ?? []));
    cursor = body.has_more ? body.next_cursor : null;
    await sleep(DELAY_MS);
  } while (cursor);
  return out;
}

function loadSeed() {
  return JSON.parse(readFileSync(SEED, "utf8"));
}

function listSeedCards(seed) {
  const cards = [];
  for (const note of seed.notas ?? []) {
    for (const card of note.flashcards ?? []) {
      const key = pageKey(card.url);
      if (!key) continue;
      cards.push({ note, card, key });
    }
  }
  return cards;
}

function sameState(a, b) {
  return (
    (a.categoria ?? null) === (b.categoria ?? null) &&
    (a.status ?? "estudo") === (b.status ?? "estudo") &&
    (a.lembrete ?? null) === (b.lembrete ?? null)
  );
}

async function pullIntoSeed() {
  const seed = loadSeed();
  const local = listSeedCards(seed);
  const remotePages = await queryAllCards();
  const byKey = new Map(remotePages.map((page) => {
    const state = readRemote(page);
    return [state.key, state];
  }));

  let changed = 0;
  let missing = 0;
  const samples = [];
  let considered = 0;

  for (const item of local) {
    if (limit && considered >= limit) break;
    considered += 1;
    const remote = byKey.get(item.key);
    if (!remote) {
      missing += 1;
      continue;
    }
    const before = {
      categoria: normalizeCategoria(item.card.categoria),
      status: normalizeStatus(item.card.status) ?? "estudo",
      lembrete: item.card.lembrete ?? null,
    };
    const next = {
      categoria: remote.categoria,
      status: remote.status,
      lembrete: remote.lembrete,
    };
    if (sameState(before, next)) continue;
    changed += 1;
    if (samples.length < 12) {
      samples.push({
        id: item.card.id,
        before,
        after: next,
      });
    }
    if (!dryRun) {
      item.card.categoria = next.categoria;
      item.card.status = next.status;
      item.card.lembrete = next.lembrete;
    }
  }

  if (!dryRun && changed) {
    writeFileSync(SEED, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  }

  return { direction: "pull", considered, changed, missing, samples, dryRun };
}

async function pushFromSeed() {
  const seed = loadSeed();
  const local = listSeedCards(seed);
  const remotePages = await queryAllCards();
  const byKey = new Map(remotePages.map((page) => [pageKey(page.id), page]));

  let changed = 0;
  let missing = 0;
  const samples = [];
  let considered = 0;

  for (const item of local) {
    if (limit && considered >= limit) break;
    considered += 1;
    const page = byKey.get(item.key);
    if (!page) {
      missing += 1;
      continue;
    }
    const remote = readRemote(page);
    const next = {
      categoria: normalizeCategoria(item.card.categoria),
      status: normalizeStatus(item.card.status) ?? "estudo",
      lembrete: item.card.lembrete ?? null,
    };
    if (sameState(remote, next)) continue;
    changed += 1;
    if (samples.length < 12) {
      samples.push({
        id: item.card.id,
        before: remote,
        after: next,
      });
    }
    if (dryRun) continue;

    const properties = {
      Lembrete: next.lembrete ? { date: { start: next.lembrete } } : { date: null },
    };
    const categoria = categoriaToNotion(next.categoria);
    if (categoria) properties.Repetition = { select: { name: categoria } };
    else properties.Repetition = { select: null };
    const status = statusToNotion(next.status);
    if (status) properties.Status = { status: { name: status } };

    await notion(`/pages/${pageUuid(item.key)}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    await sleep(DELAY_MS);
  }

  return { direction: "push", considered, changed, missing, samples, dryRun };
}

const result = push ? await pushFromSeed() : await pullIntoSeed();
console.log(
  JSON.stringify(
    {
      ok: true,
      mode: dryRun ? "dry-run" : "apply",
      ...result,
    },
    null,
    2,
  ),
);
