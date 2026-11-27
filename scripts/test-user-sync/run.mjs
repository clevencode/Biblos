/**
 * Teste do motor de sync das atividades (user-sync) com Firestore em memória.
 * Simula gestos, fecho do navegador antes do envio, offline, outra aba e logout.
 * Uso: npm run test:user-sync
 */
import { build } from "rolldown";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = mkdtempSync(path.join(tmpdir(), "biblos-user-sync-"));
const outFile = path.join(outDir, "test.mjs");

try {
  await build({
    input: path.join(here, "test.ts"),
    platform: "node",
    logLevel: "warn",
    transform: {
      define: { "import.meta.env.DEV": "false", "import.meta.env": "{}" },
    },
    plugins: [
      {
        name: "user-sync-mocks",
        resolveId(source) {
          if (source === "firebase/firestore") {
            return path.join(here, "mock-firestore.ts");
          }
          if (/lib\/firebase$/.test(source)) {
            return path.join(here, "mock-firebase.ts");
          }
          return null;
        },
      },
    ],
    output: { file: outFile, format: "esm", codeSplitting: false },
  });
  const run = spawnSync(process.execPath, [outFile], { stdio: "inherit" });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
