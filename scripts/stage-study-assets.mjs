/**
 * Copia data/bible/study/tske → public/bible/study/tske para o Vite embutir no dist.
 * TSKE é obrigatório para refs cruzadas no deploy.
 * Gera `tske/manifest.json` para listagem offline.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "bible", "study");
const DEST = join(ROOT, "public", "bible", "study");
const TSKE_SRC = join(SRC, "tske");
const TSKE_DEST = join(DEST, "tske");

const optional = process.argv.includes("--optional");

if (!existsSync(TSKE_SRC)) {
  const msg =
    "stage-study-assets: missing data/bible/study/tske — run bible:study:export";
  if (optional) {
    console.warn(msg, "(skipped)");
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}

if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

cpSync(TSKE_SRC, TSKE_DEST, { recursive: true });

const files = readdirSync(TSKE_SRC)
  .filter((name) => name.endsWith(".json") && name !== "manifest.json")
  .map((name) => name.replace(/\.json$/i, ""))
  .sort();

writeFileSync(
  join(TSKE_DEST, "manifest.json"),
  `${JSON.stringify({ version: 1, files }, null, 0)}\n`,
  "utf8",
);

// Diksyonè Vilsen (HT98) — opcional: sem a pasta, o leitor só esconde o dicionário.
const DICT_SRC = join(SRC, "dict");
const DICT_DEST = join(DEST, "dict");
let dictFiles = 0;
if (existsSync(DICT_SRC)) {
  mkdirSync(DICT_DEST, { recursive: true });
  for (const name of readdirSync(DICT_SRC)) {
    if (!name.endsWith(".json")) continue;
    cpSync(join(DICT_SRC, name), join(DICT_DEST, name));
    dictFiles += 1;
  }
} else {
  console.warn("stage-study-assets: data/bible/study/dict ausente (dicionário HT desativado)");
}

console.log(
  `OK: staged study assets → public/bible/study (tske ${files.length} + manifest, dict ${dictFiles})`,
);
