/**
 * Obtém android/app/google-services.json do projeto Firebase (audiobible-9b689)
 * e regista SHA-1/256 do keystore debug (e release se key.properties existir).
 *
 * Pré-requisito: npx firebase-tools login  (conta dona do projeto)
 *
 * Uso:
 *   node scripts/fetch-google-services.mjs
 *   npm run firebase:google-services
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = resolve(root, "android/app/google-services.json");
const PACKAGE_NAME = "app.biblos.mobile";
const APP_DISPLAY_NAME = "Biblos";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

const env = {
  ...loadEnvFile(resolve(root, ".env")),
  ...loadEnvFile(resolve(root, ".env.local")),
  ...process.env,
};

const PROJECT_ID = String(
  env.VITE_FIREBASE_PROJECT_ID || "audiobible-9b689",
).trim();

function runFirebase(args, { json = false, allowFail = false } = {}) {
  const full = ["-y", "firebase-tools@latest", ...args, "--project", PROJECT_ID];
  if (json) full.push("--json");
  const result = spawnSync("npx", full, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0 && !allowFail) {
    const blob = `${stdout}\n${stderr}`;
    if (/Failed to authenticate|login/i.test(blob)) {
      console.error(
        "[fetch-google-services] Firebase CLI sem login.\n" +
          "  → Corre: npx firebase-tools@latest login\n" +
          "  → Depois: npm run firebase:google-services",
      );
      process.exit(1);
    }
    console.error(blob.trim() || `firebase exit ${result.status}`);
    process.exit(result.status ?? 1);
  }
  return { stdout, stderr, status: result.status ?? 0 };
}

function parseJsonPayload(stdout) {
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Resposta Firebase não é JSON válido");
  }
}

function listAndroidApps() {
  const { stdout } = runFirebase(["apps:list", "ANDROID"], { json: true });
  const payload = parseJsonPayload(stdout);
  const result = payload?.result ?? payload;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.apps)) return result.apps;
  return [];
}

function createAndroidApp() {
  console.log(
    `[fetch-google-services] A criar app Android ${PACKAGE_NAME} no projeto ${PROJECT_ID}…`,
  );
  const { stdout } = runFirebase(
    [
      "apps:create",
      "ANDROID",
      APP_DISPLAY_NAME,
      "--package-name",
      PACKAGE_NAME,
    ],
    { json: true },
  );
  const payload = parseJsonPayload(stdout);
  const app = payload?.result ?? payload;
  const appId = app?.appId ?? app?.app_id ?? null;
  if (!appId) {
    console.error("[fetch-google-services] apps:create sem appId", stdout);
    process.exit(1);
  }
  return String(appId);
}

function downloadSdkConfig(appId) {
  console.log(`[fetch-google-services] A descarregar sdkconfig ${appId}…`);
  const { stdout } = runFirebase(["apps:sdkconfig", "ANDROID", appId], {
    json: true,
  });
  const payload = parseJsonPayload(stdout);
  const result = payload?.result ?? payload;
  const fileContents =
    typeof result?.fileContents === "string"
      ? result.fileContents
      : typeof result === "string"
        ? result
        : result?.sdkConfig
          ? JSON.stringify(result.sdkConfig, null, 2)
          : null;
  if (!fileContents) {
    // fallback sem --json
    const plain = runFirebase(["apps:sdkconfig", "ANDROID", appId]);
    const text = plain.stdout.trim();
    if (!text.startsWith("{")) {
      console.error("[fetch-google-services] sdkconfig inválido");
      process.exit(1);
    }
    return text;
  }
  return fileContents;
}

function keytoolSha(keystore, alias, storePass, keyPass) {
  try {
    const out = execFileSync(
      "keytool",
      [
        "-list",
        "-v",
        "-keystore",
        keystore,
        "-alias",
        alias,
        "-storepass",
        storePass,
        "-keypass",
        keyPass || storePass,
      ],
      { encoding: "utf8" },
    );
    const sha1 = /SHA1:\s*([0-9A-Fa-f:]+)/.exec(out)?.[1]?.replace(/:/g, "");
    const sha256 = /SHA256:\s*([0-9A-Fa-f:]+)/.exec(out)?.[1]?.replace(/:/g, "");
    return { sha1, sha256 };
  } catch (err) {
    console.warn(
      "[fetch-google-services] keytool falhou:",
      err instanceof Error ? err.message : err,
    );
    return { sha1: null, sha256: null };
  }
}

function collectShaHashes() {
  const hashes = [];
  const debugStore = resolve(homedir(), ".android/debug.keystore");
  if (existsSync(debugStore)) {
    const debug = keytoolSha(debugStore, "androiddebugkey", "android", "android");
    if (debug.sha1) hashes.push({ label: "debug", ...debug });
  }

  const propsPath = resolve(root, "android/key.properties");
  const releaseStore = resolve(root, "android/keystore/biblos-upload.jks");
  if (existsSync(propsPath) && existsSync(releaseStore)) {
    const props = Object.fromEntries(
      readFileSync(propsPath, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
    if (props.storePassword && props.keyAlias) {
      const release = keytoolSha(
        releaseStore,
        props.keyAlias,
        props.storePassword,
        props.keyPassword || props.storePassword,
      );
      if (release.sha1) hashes.push({ label: "release", ...release });
    }
  }
  return hashes;
}

function listExistingSha(appId) {
  const { stdout, status } = runFirebase(
    ["apps:android:sha:list", appId],
    { json: true, allowFail: true },
  );
  if (status !== 0) return new Set();
  try {
    const payload = parseJsonPayload(stdout);
    const rows = payload?.result ?? payload ?? [];
    const set = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      const h = String(row?.shaHash ?? row?.sha_hash ?? "").replace(/:/g, "");
      if (h) set.add(h.toUpperCase());
    }
    return set;
  } catch {
    return new Set();
  }
}

function ensureShaHashes(appId) {
  const hashes = collectShaHashes();
  if (!hashes.length) {
    console.warn("[fetch-google-services] Nenhum SHA local encontrado.");
    return;
  }
  const existing = listExistingSha(appId);
  for (const { label, sha1, sha256 } of hashes) {
    for (const [kind, value] of [
      ["SHA-1", sha1],
      ["SHA-256", sha256],
    ]) {
      if (!value) continue;
      const normalized = value.replace(/:/g, "").toUpperCase();
      if (existing.has(normalized)) {
        console.log(
          `[fetch-google-services] ${label} ${kind} já registado.`,
        );
        continue;
      }
      console.log(
        `[fetch-google-services] A registar ${label} ${kind}…`,
      );
      runFirebase(["apps:android:sha:create", appId, value], {
        allowFail: true,
      });
    }
  }
}

function extractWebClientId(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    for (const client of data.client ?? []) {
      for (const oauth of client.oauth_client ?? []) {
        if (oauth.client_type === 3 && oauth.client_id) {
          return String(oauth.client_id);
        }
      }
      for (const oauth of client.services?.appinvite_service
        ?.other_platform_oauth_client ?? []) {
        if (oauth.client_type === 3 && oauth.client_id) {
          return String(oauth.client_id);
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function hintWebClientId(jsonText) {
  const id = extractWebClientId(jsonText);
  if (!id) return;
  console.log(
    `[fetch-google-services] Web client ID (opcional no .env):\n` +
      `  VITE_FIREBASE_WEB_CLIENT_ID=${id}`,
  );
}

function main() {
  console.log(
    `[fetch-google-services] Projeto ${PROJECT_ID} → ${outPath}`,
  );

  let apps = listAndroidApps();
  let app =
    apps.find(
      (a) =>
        String(a.packageName ?? a.package_name ?? "") === PACKAGE_NAME,
    ) ?? null;

  let appId = app ? String(app.appId ?? app.app_id) : null;
  if (!appId) {
    appId = createAndroidApp();
    apps = listAndroidApps();
    app =
      apps.find(
        (a) =>
          String(a.packageName ?? a.package_name ?? "") === PACKAGE_NAME,
      ) ?? null;
    appId = app ? String(app.appId ?? app.app_id) : appId;
  } else {
    console.log(`[fetch-google-services] App Android existente: ${appId}`);
  }

  ensureShaHashes(appId);

  // Re-download após SHA (oauth_client pode actualizar)
  const contents = downloadSdkConfig(appId);
  writeFileSync(outPath, `${contents.trim()}\n`, "utf8");
  console.log(`[fetch-google-services] Escrito ${outPath}`);
  hintWebClientId(contents);

  console.log(
    "[fetch-google-services] OK. Seguinte: npm run mobile:sync",
  );
}

main();
