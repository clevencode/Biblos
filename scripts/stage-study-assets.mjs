import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "bible", "study");
const DEST = join(ROOT, "public", "bible", "study");

if (!existsSync(SRC)) {
  console.error("stage-study-assets: missing", SRC, "— run export-study-compilado.mjs");
  process.exit(1);
}

if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });
mkdirSync(dirname(DEST), { recursive: true });
cpSync(SRC, DEST, { recursive: true });
console.log("OK: staged study assets → public/bible/study");
