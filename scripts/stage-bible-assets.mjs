/**
 * Copia data/bible/s21 → public/bible/s21 para o Vite embutir no dist/APK.
 * Fonte única: data/bible/s21 (não duplicar no git).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "bible", "s21");
const DEST = join(ROOT, "public", "bible", "s21");

if (!existsSync(SRC)) {
  console.error("stage-bible-assets: missing", SRC);
  process.exit(1);
}

if (existsSync(DEST)) {
  rmSync(DEST, { recursive: true, force: true });
}
mkdirSync(dirname(DEST), { recursive: true });
cpSync(SRC, DEST, { recursive: true });
console.log("OK: staged S21 bible assets → public/bible/s21");
