/**
 * Prepare local Android release: dirty-git check, sync versionName, bump versionCode,
 * then build:mobile + cap sync.
 *
 * Usage: npm run mobile:release:prepare
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "package.json");
const GRADLE = join(ROOT, "android", "app", "build.gradle");

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
}

const porcelain = execSync("git status --porcelain", {
  cwd: ROOT,
  encoding: "utf8",
}).trim();
if (porcelain) {
  console.error(
    "mobile:release:prepare: working tree sujo — commit ou stash antes do bump.\n",
  );
  console.error(porcelain);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PKG, "utf8"));
const versionName = String(pkg.version ?? "").trim();
if (!/^\d+\.\d+\.\d+/.test(versionName)) {
  console.error(
    `mobile:release:prepare: package.json version inválida: ${versionName}`,
  );
  process.exit(1);
}

let gradle = readFileSync(GRADLE, "utf8");
const codeMatch = gradle.match(/versionCode\s+(\d+)/);
if (!codeMatch) {
  console.error("mobile:release:prepare: versionCode não encontrado em build.gradle");
  process.exit(1);
}
const nextCode = Number(codeMatch[1]) + 1;
if (!Number.isFinite(nextCode) || nextCode <= 0) {
  console.error("mobile:release:prepare: versionCode inválido");
  process.exit(1);
}

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
if (/versionName\s+"[^"]+"/.test(gradle)) {
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
} else {
  console.error("mobile:release:prepare: versionName não encontrado em build.gradle");
  process.exit(1);
}
writeFileSync(GRADLE, gradle, "utf8");

console.log(
  `mobile:release:prepare: versionName=${versionName} versionCode=${nextCode}`,
);
console.log("mobile:release:prepare: build:mobile + cap sync android…");
run("npm run build:mobile");
run("npx cap sync android");
console.log("OK: android pronto para npm run mobile:gradle:release");
