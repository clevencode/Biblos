/**
 * Atribui custom claim `admin: true` a um utilizador Firebase Auth (CMS editorial).
 *
 * Pré-requisitos:
 *   - Conta de serviço com permissão no projeto (não commitar o JSON)
 *   - Env: FIREBASE_SERVICE_ACCOUNT_PATH=C:\path\to\serviceAccount.json
 *     ou GOOGLE_APPLICATION_CREDENTIALS=...
 *
 * Uso:
 *   npm run firebase:set-editor-claim -- --email voce@exemplo.com
 *   npm run firebase:set-editor-claim -- --uid <firebaseUid>
 *
 * Depois: o editor deve re-login (ou getIdToken(true)) para o claim entrar no token.
 * Deploy das rules: npm run firebase:deploy-rules
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function parseArgs(argv) {
  const out = { email: "", uid: "", revoke: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email" && argv[i + 1]) out.email = String(argv[++i]).trim();
    else if (a === "--uid" && argv[i + 1]) out.uid = String(argv[++i]).trim();
    else if (a === "--revoke") out.revoke = true;
  }
  return out;
}

function ensureFirebaseAdmin() {
  try {
    const require = createRequire(resolve(root, "package.json"));
    return require("firebase-admin");
  } catch {
    console.log("A instalar firebase-admin (dev, one-shot)…");
    const r = spawnSync(
      "npm",
      ["install", "--no-save", "firebase-admin@^13"],
      { cwd: root, shell: true, stdio: "inherit" },
    );
    if (r.status !== 0) {
      throw new Error("Falha ao instalar firebase-admin");
    }
    const require = createRequire(resolve(root, "package.json"));
    return require("firebase-admin");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email && !args.uid) {
    console.error(
      "Uso: npm run firebase:set-editor-claim -- --email admin@exemplo.com\n" +
        "  ou: npm run firebase:set-editor-claim -- --uid <uid> [--revoke]",
    );
    process.exit(1);
  }

  const saPath = String(
    env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      env.GOOGLE_APPLICATION_CREDENTIALS ||
      "",
  ).trim();
  if (!saPath || !existsSync(saPath)) {
    console.error(
      "Defina FIREBASE_SERVICE_ACCOUNT_PATH (ou GOOGLE_APPLICATION_CREDENTIALS)\n" +
        "para o JSON da conta de serviço Firebase (não versionar).",
    );
    process.exit(1);
  }

  const projectId = String(
    env.VITE_FIREBASE_PROJECT_ID || "audiobible-9b689",
  ).trim();

  const admin = ensureFirebaseAdmin();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(readFileSync(saPath, "utf8"))),
      projectId,
    });
  }

  const auth = admin.auth();
  const user = args.uid
    ? await auth.getUser(args.uid)
    : await auth.getUserByEmail(args.email);

  const nextClaims = { ...(user.customClaims || {}) };
  if (args.revoke) {
    delete nextClaims.admin;
  } else {
    nextClaims.admin = true;
  }

  await auth.setCustomUserClaims(user.uid, nextClaims);
  console.log(
    args.revoke
      ? `Claim admin removido de ${user.email || user.uid}`
      : `Claim admin=true definido em ${user.email || user.uid} (${user.uid})`,
  );
  console.log(
    "O utilizador deve terminar sessão e voltar a entrar (ou refresh do ID token).",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
