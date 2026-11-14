/**
 * Pré-voo mobile: auth + planos remotos (Firebase) precisam estar no bundle APK.
 * Falha cedo com mensagem acionável — evita APK “offline_guest / unconfigured”.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = {
  ...loadEnvFile(resolve(root, ".env")),
  ...loadEnvFile(resolve(root, ".env.local")),
  ...process.env,
};

const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

const missing = required.filter((key) => !String(env[key] ?? "").trim());
const googleServices = resolve(root, "android/app/google-services.json");
const hasGoogleServices = existsSync(googleServices);
const webClientId = String(env.VITE_FIREBASE_WEB_CLIENT_ID ?? "").trim();

const errors = [];
const warnings = [];

if (missing.length) {
  errors.push(
    `Variáveis Firebase em falta no .env: ${missing.join(", ")}\n` +
      `  → Sem isto o APK fica em offline_guest / planos unconfigured.`,
  );
}

const allowWithoutNative =
  String(env.ALLOW_MOBILE_WITHOUT_GOOGLE_SERVICES ?? "").trim() === "1";

if (!hasGoogleServices) {
  const msg =
    `android/app/google-services.json ausente.\n` +
    `  → Firebase Console → Add Android app (app.biblos.mobile) → download.\n` +
    `  → Sem ficheiro: plugin google-services não aplica; Google Sign-In nativo falha.\n` +
    `  → Bypass temporário: ALLOW_MOBILE_WITHOUT_GOOGLE_SERVICES=1`;
  if (allowWithoutNative) warnings.push(msg);
  else errors.push(msg);
}

if (!webClientId) {
  warnings.push(
    `VITE_FIREBASE_WEB_CLIENT_ID vazio (opcional mas recomendado para Google).\n` +
      `  → Console Google Cloud → OAuth 2.0 Client IDs → Web client.`,
  );
}

for (const w of warnings) {
  console.warn(`[ensure-mobile-remote] ⚠ ${w}`);
}

if (errors.length) {
  for (const e of errors) {
    console.error(`[ensure-mobile-remote] ✖ ${e}`);
  }
  console.error(
    `\n[ensure-mobile-remote] Corrija e volte a correr (ver .env.example § Firebase).`,
  );
  process.exit(1);
}

console.log(
  "[ensure-mobile-remote] OK — Firebase env + google-services.json prontos para auth/planos remotos.",
);
