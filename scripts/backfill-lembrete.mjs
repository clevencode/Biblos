/**
 * Backfill Lembrete em cartões Notion activos (Estudo/Espera) sem data,
 * apenas cartões recentes de agosto/2026. Encerrados e meses anteriores ficam de fora.
 * Usa Criado em + 2 dias (intervalo "novo"), alinhado ao StudyOS.
 *
 *   node scripts/backfill-lembrete.mjs --dry-run
 *   node scripts/backfill-lembrete.mjs --apply
 *   node scripts/backfill-lembrete.mjs --apply --limit=20
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CARDS_DB = "cb1e0098-7dca-417b-b03b-478601d76d0b";
const CARDS_DS = "44dfaba4-e906-40d3-a699-156a7c39daa2";
const SEED = join(process.cwd(), "src", "data", "seed.json");
const VERSION = "2022-06-28";
const DELAY_MS = 120;
const NOVO_DAYS = 2;
const AUGUST_START = "2026-08-01";
const AUGUST_END = "2026-09-01";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");
const limit = Number([...args].find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || 0;

function readDotEnvToken() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*NOTION_TOKEN\s*=\s*(.*)$/);
      if (!m) continue;
      return m[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return process.env.NOTION_TOKEN || "";
}

const token = readDotEnvToken();
if (!token) {
  console.error("NOTION_TOKEN ausente no .env");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Notion-Version": VERSION,
  "Content-Type": "application/json",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

function pageUuid(hex32) {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`;
}

function dateKey(value) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function defaultLembrete(criadoEm) {
  const base = dateKey(criadoEm) || dateKey(new Date().toISOString());
  return addDays(base, NOVO_DAYS);
}

async function notion(path, init = {}, retries = 4) {
  let lastErr = new Error(`Notion request failed: ${path}`);
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
          `${init.method || "GET"} ${path} → ${res.status}: ${body.message || JSON.stringify(body).slice(0, 300)}`,
        );
      }
      return body;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

function isAugust2026(criado) {
  const day = dateKey(criado);
  return day >= AUGUST_START && day < AUGUST_END;
}

async function queryStatusMissing(status) {
  const out = [];
  let cursor;
  do {
    const body = await notion(`/databases/${CARDS_DB}/query`, {
      method: "POST",
      body: JSON.stringify({
        page_size: 100,
        filter: {
          and: [
            { property: "Status", status: { equals: status } },
            { property: "Lembrete", date: { is_empty: true } },
            { property: "Criado em", created_time: { on_or_after: `${AUGUST_START}T00:00:00.000Z` } },
            { property: "Criado em", created_time: { before: `${AUGUST_END}T00:00:00.000Z` } },
          ],
        },
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    out.push(...(body.results ?? []));
    cursor = body.has_more ? body.next_cursor : null;
    await sleep(DELAY_MS);
  } while (cursor);
  return out;
}

async function queryMissing() {
  const estudo = await queryStatusMissing("Estudo");
  const espera = await queryStatusMissing("Espera");
  return [...estudo, ...espera];
}

function patchSeed(updates) {
  const seed = JSON.parse(readFileSync(SEED, "utf8"));
  const byKey = new Map(updates.map((u) => [u.key, u]));
  let changed = 0;
  for (const note of seed.notas ?? []) {
    for (const card of note.flashcards ?? []) {
      const key = pageKey(card.url);
      const next = key ? byKey.get(key) : null;
      if (!next) continue;
      if (card.lembrete !== next.lembrete || card.criadoEm !== next.criadoEm) {
        card.lembrete = next.lembrete;
        if (next.criadoEm) card.criadoEm = next.criadoEm;
        changed += 1;
      }
    }
  }
  if (changed) writeFileSync(SEED, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  return changed;
}

try {
  const pages = await queryMissing();
  const targets = limit ? pages.slice(0, limit) : pages;
  const updates = [];
  let patched = 0;
  let failed = 0;

  for (const page of targets) {
    const key = pageKey(page.id);
    const criado = page.properties?.["Criado em"]?.created_time || page.created_time;
    if (!isAugust2026(criado)) continue;
    const lembrete = defaultLembrete(criado);
    const criadoEm = dateKey(criado) || null;
    updates.push({ key, lembrete, criadoEm, url: page.url });
    if (dryRun) continue;
    try {
      await notion(`/pages/${pageUuid(key)}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: { Lembrete: { date: { start: lembrete } } },
        }),
      });
      patched += 1;
      await sleep(DELAY_MS);
    } catch (err) {
      failed += 1;
      console.error(String(err));
    }
  }

  const seedChanged = dryRun ? 0 : patchSeed(updates);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: dryRun ? "dry-run" : "apply",
        found: pages.length,
        targeted: targets.length,
        patched,
        failed,
        seedChanged,
        samples: updates.slice(0, 8),
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error("backfill failed:", err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack.split("\n").slice(0, 6).join("\n"));
  process.exit(1);
}
