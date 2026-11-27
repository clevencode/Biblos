/**
 * Importa o Diksyonè Kreyòl Vilsen (repo privado clevencode/dicvilsen) para
 * data/bible/study/dict/ht-vilsen.json — formato compacto para o leitor HT98.
 *
 * Usage:
 *   npm run dict:import                              # via `gh api` (repo privado)
 *   npm run dict:import -- --from ../dicvilsen/data/entries.json
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "bible", "study", "dict");
const OUT = join(OUT_DIR, "ht-vilsen.json");
const REPO = "clevencode/dicvilsen";
const REPO_PATH = "data/entries.json";

function readSource() {
  const fromIdx = process.argv.indexOf("--from");
  if (fromIdx >= 0) {
    const file = resolve(process.argv[fromIdx + 1] || "");
    return { text: readFileSync(file, "utf8"), source: file };
  }
  const text = execFileSync(
    "gh",
    ["api", `repos/${REPO}/contents/${REPO_PATH}`, "-H", "Accept: application/vnd.github.raw"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return { text, source: `github:${REPO}/${REPO_PATH}` };
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const { text, source } = readSource();
const raw = JSON.parse(text);
if (!Array.isArray(raw)) throw new Error("entries.json: esperado um array");

const entries = [];
const byPos = new Map();
let rejected = 0;
for (const item of raw) {
  const id = Number(item?.id);
  const lemma = clean(item?.lemma).normalize("NFC");
  const pos = clean(item?.pos);
  const gloss = clean(item?.gloss).normalize("NFC");
  if (!Number.isFinite(id) || !lemma || !gloss) {
    rejected += 1;
    continue;
  }
  entries.push([id, lemma, pos, gloss]);
  byPos.set(pos, (byPos.get(pos) ?? 0) + 1);
}

const payload = {
  version: 1,
  lang: "ht",
  source,
  title: "Diksyonè Kreyòl Vilsen, 3yèm edisyon",
  attribution:
    "Diksyonè Kreyòl Vilsen, 3yèm edisyon — Féquière Vilsaint & Maude Heurtelou. © Educa Vision Inc.",
  count: entries.length,
  /** [id, lemma, pos, gloss] */
  entries,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload)}\n`, "utf8");

const kb = Math.round(Buffer.byteLength(JSON.stringify(payload)) / 1024);
console.log(`OK: ${entries.length} entradas → ${OUT} (${kb} KB, rejeitadas: ${rejected})`);
console.log(
  [...byPos]
    .sort((a, b) => b[1] - a[1])
    .map(([pos, n]) => `${pos || "(sem pos)"}:${n}`)
    .join(" "),
);
