/**
 * Extrai entradas Strong (H/G) de estudo-biblia-compilado.txt
 *
 * Usage:
 *   node scripts/export-strong-lexicon.mjs [caminho-compilado.txt]
 */
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "bible", "study", "strong");
const DEFAULT_COMPILADO = resolve(
  process.env.USERPROFILE || process.env.HOME || "",
  "Downloads",
  "estudo-biblia-compilado.txt",
);

const ENTRY_START = /^\[(H|G)(\d+)\]$/i;

const FIELD_START =
  /^(Original:|Transliteration:|Phonetic:|BDB Definition\s*:|Thayer Definition\s*:|TWOT entry:|TDNT entry:|Part\(s\) of speech:|Strong.s Definition\s*:|Total KJV Occurrences\s*:|\S+ \(\d+\)$)/;

function canonicalId(letter, num) {
  return `${letter.toUpperCase()}${Number(num)}`;
}

function fieldKey(trimmed) {
  if (trimmed.startsWith("Original:")) return "original";
  if (trimmed.startsWith("Transliteration:")) return "transliteration";
  if (trimmed.startsWith("Phonetic:")) return "phonetic";
  if (trimmed.includes("BDB Definition")) return "bdb";
  if (trimmed.includes("Thayer Definition")) return "thayer";
  if (trimmed.startsWith("Part(s) of speech:")) return "partOfSpeech";
  if (/Strong.s Definition/i.test(trimmed)) return "definition";
  return null;
}

function fieldValue(trimmed, key) {
  const parts = trimmed.split(":");
  if (parts.length < 2) return "";
  return parts.slice(1).join(":").trim();
}

function parseEntryBody(lines) {
  /** @type {Record<string, string>} */
  const out = {};
  /** @type {string | null} */
  let collect = null;
  const chunks = [];

  function flushCollect() {
    if (!collect) return;
    const text = chunks.join(" ").replace(/\s+/g, " ").trim();
    if (collect === "bdb") {
      out.detailType = "bdb";
      out.detail = text;
    } else if (collect === "thayer") {
      out.detailType = "thayer";
      out.detail = text;
    }
    collect = null;
    chunks.length = 0;
  }

  for (const raw of lines) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) continue;
    const key = fieldKey(trimmed);
    if (key === "bdb" || key === "thayer") {
      flushCollect();
      const inline = fieldValue(trimmed, key);
      if (inline) {
        if (key === "bdb") {
          out.detailType = "bdb";
          out.detail = inline;
        } else {
          out.detailType = "thayer";
          out.detail = inline;
        }
      } else {
        collect = key;
      }
      continue;
    }
    if (collect && !FIELD_START.test(trimmed) && !trimmed.match(/^[A-Za-z].*\(\d+\)$/)) {
      chunks.push(trimmed);
      continue;
    }
    flushCollect();
    if (key === "definition") {
      out.definition = fieldValue(trimmed, key);
    } else if (key === "original" || key === "transliteration" || key === "phonetic" || key === "partOfSpeech") {
      out[key] = fieldValue(trimmed, key);
    }
  }
  flushCollect();

  if (!out.definition && !out.detail && !out.original) return null;
  return out;
}

async function main() {
  const input = resolve(process.argv[2] || DEFAULT_COMPILADO);
  let mode = false;
  /** @type {string | null} */
  let currentId = null;
  /** @type {string[]} */
  let bodyLines = [];
  /** @type {Map<string, object>} */
  const entries = new Map();

  function flush() {
    if (!currentId) return;
    const parsed = parseEntryBody(bodyLines);
    if (parsed) {
      entries.set(currentId, { id: currentId, ...parsed });
    }
    currentId = null;
    bodyLines = [];
  }

  const rl = createInterface({
    input: createReadStream(input, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.includes("Strong — léxico")) {
      mode = true;
      continue;
    }
    if (mode && line.includes("Nave —")) {
      flush();
      mode = false;
      continue;
    }
    if (!mode) continue;

    const m = line.match(ENTRY_START);
    if (m) {
      flush();
      currentId = canonicalId(m[1], m[2]);
      continue;
    }
    if (currentId) {
      bodyLines.push(line);
    }
  }
  flush();

  await mkdir(OUT, { recursive: true });
  let written = 0;
  for (const [id, data] of entries) {
    await writeFile(join(OUT, `${id}.json`), JSON.stringify(data));
    written++;
  }

  const manifest = {
    version: 1,
    entries: written,
    format: "strong/{H|G}{n}.json",
    source: "strong.dct.mybible via compilado",
  };
  await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`OK: strong lexicon entries=${written}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
