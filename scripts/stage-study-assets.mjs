/**
 * Copia data/bible/study → public/bible/study (TSKE etc.) para o Vite embutir no dist.
 * TSKE é obrigatório para refs cruzadas no deploy; outros módulos são opcionais.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "bible", "study");
const DEST = join(ROOT, "public", "bible", "study");
const TSKE_SRC = join(SRC, "tske");

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

// Sempre stage TSKE (refs croisées).
cpSync(TSKE_SRC, join(DEST, "tske"), { recursive: true });

for (const name of ["strong", "sg1910"]) {
  const from = join(SRC, name);
  if (!existsSync(from)) continue;
  cpSync(from, join(DEST, name), { recursive: true });
}

console.log("OK: staged study assets → public/bible/study (tske + optionnels)");
