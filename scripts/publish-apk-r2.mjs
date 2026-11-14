/**
 * Publica o APK release no Cloudflare R2 (mesmo object key → ETag muda → update banner).
 *
 * Manual (dashboard): R2 → bucket → Upload por cima de biblos.apk, Cache-Control: no-cache.
 * Script:
 *   npm run mobile:apk:publish
 *   npm run mobile:apk:release:publish   # build release + upload
 *
 * Env (local /.env ou shell — nunca commitar o token):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN     (R2 Edit)  — ou `npx wrangler login`
 *   R2_BUCKET                (ex. biblos-apk)
 *   R2_OBJECT_KEY            (default: biblos.apk)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APK = join(
  ROOT,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "Biblos.apk",
);

function loadDotEnv() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val === "") continue;
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

// Token vazio no .env / shell parte o header Authorization do wrangler.
if (!String(process.env.CLOUDFLARE_API_TOKEN ?? "").trim()) {
  delete process.env.CLOUDFLARE_API_TOKEN;
}

const bucket = String(process.env.R2_BUCKET ?? "").trim();
const key = String(process.env.R2_OBJECT_KEY ?? "biblos.apk").trim() || "biblos.apk";
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN ?? "").trim();

if (!existsSync(APK)) {
  console.error("publish-apk-r2: APK em falta — corre antes: npm run mobile:apk:release");
  console.error(" ", APK);
  process.exit(1);
}

if (!bucket) {
  console.error("publish-apk-r2: define R2_BUCKET no .env (ex. biblos-apk)");
  process.exit(1);
}

if (!accountId && !apiToken) {
  console.warn(
    "publish-apk-r2: sem CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN — a tentar wrangler login…",
  );
} else if (!apiToken) {
  console.warn(
    "publish-apk-r2: sem CLOUDFLARE_API_TOKEN — a tentar sessão wrangler login…",
  );
}

const remote = `${bucket}/${key}`;
console.log(`publish-apk-r2: ${APK}`);
console.log(`publish-apk-r2: → r2://${remote}`);

// Account via env CLOUDFLARE_ACCOUNT_ID (wrangler lê automaticamente; sem --account-id).
const args = [
  "--yes",
  "wrangler",
  "r2",
  "object",
  "put",
  remote,
  `--file=${APK}`,
  "--remote",
  "--content-type=application/vnd.android.package-archive",
  "--cache-control=no-cache",
];

const result = spawnSync("npx", args, {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.status !== 0) {
  console.error("publish-apk-r2: falhou (wrangler). Confirma token R2 Edit e o nome do bucket.");
  process.exit(result.status ?? 1);
}

const publicUrl = String(process.env.VITE_APK_DOWNLOAD_URL ?? "").trim();
console.log("OK: APK publicado no R2 (mesmo key → novo ETag).");
if (publicUrl) {
  console.log("VITE_APK_DOWNLOAD_URL:", publicUrl);
  const placeholder =
    publicUrl === "https://r2.dev" ||
    publicUrl === "/downloads/biblos.apk" ||
    publicUrl.endsWith("r2.dev");
  if (placeholder) {
    console.warn("Aviso: URL parece placeholder — define o URL público real do objecto no R2.");
  }
}
