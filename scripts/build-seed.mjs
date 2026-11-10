/**
 * Gera src/data/seed.json a partir do Notion (BIBLECARDS + PLAN).
 * Usage: node scripts/build-seed.mjs
 * Requer NOTION_TOKEN no .env
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog } from "../api/catalog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sem .env */
  }
}

loadEnv();

const token = process.env.NOTION_TOKEN || "";
if (!token) {
  console.error("NOTION_TOKEN em falta");
  process.exit(1);
}

const catalog = await buildCatalog(token, { full: true });
const out = {
  notas: catalog.notas,
  plans: catalog.plans,
};
const path = join(root, "src", "data", "seed.json");
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(
  `seed.json: ${catalog.cardCount} cartes, ${catalog.planCount} plans → ${path}`,
);
