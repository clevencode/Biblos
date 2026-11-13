/**
 * Copia data/bible/study → public/bible/study (TSKE etc.) para o Vite embutir no dist.
 * TSKE é obrigatório para refs cruzadas no deploy; outros módulos são opcionais.
 * Gera also `tske/manifest.json` para o pack offline IndexedDB.
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

for (const name of ["strong", "sg1910"]) {
  const from = join(SRC, name);
  if (!existsSync(from)) continue;
  cpSync(from, join(DEST, name), { recursive: true });
}

console.log(
  `OK: staged study assets → public/bible/study (tske ${files.length} + manifest)`,
);
