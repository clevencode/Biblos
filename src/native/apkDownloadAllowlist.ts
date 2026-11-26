/**
 * Allowlist de URLs para download/instalação de APK.
 * Espelhado no nativo (`ApkInstallerPlugin`) — o JS não é a única barreira.
 */

const DEFAULT_HOST_SUFFIXES = [".r2.dev"];

function configuredHostSuffixes(): string[] {
  const raw = String(import.meta.env.VITE_APK_ALLOWED_HOST_SUFFIXES ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return DEFAULT_HOST_SUFFIXES;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => (s.startsWith(".") ? s : `.${s}`));
  return parsed.length > 0 ? parsed : DEFAULT_HOST_SUFFIXES;
}

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true; // IPv6
  return false;
}

function hostAllowed(host: string, suffixes: string[]): boolean {
  const h = host.toLowerCase();
  if (isIpLiteral(h)) return false;
  return suffixes.some(
    (suffix) => h === suffix.slice(1) || h.endsWith(suffix),
  );
}

/** True se HTTPS, host na allowlist e path termina em `.apk`. */
export function isAllowedApkDownloadUrl(raw: string): boolean {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (!url.hostname || isIpLiteral(url.hostname)) return false;
  if (!hostAllowed(url.hostname, configuredHostSuffixes())) return false;
  const path = url.pathname.toLowerCase();
  if (!path.endsWith(".apk")) return false;
  return true;
}

export function assertAllowedApkDownloadUrl(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!isAllowedApkDownloadUrl(trimmed)) {
    throw new Error("URL de APK fora da allowlist (HTTPS + host + .apk)");
  }
  return trimmed;
}
