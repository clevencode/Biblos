import { registerPlugin } from "@capacitor/core";
import { assertAllowedApkDownloadUrl } from "./apkDownloadAllowlist";

type ApkInstallerNative = {
  downloadAndInstall(options: { url: string }): Promise<void>;
};

const native = registerPlugin<ApkInstallerNative>("ApkInstaller");

export type ApkInstallerPlugin = {
  downloadAndInstall(options: { url: string }): Promise<void>;
};

/** Wrapper: valida allowlist no JS antes do nativo (nativo revalida). */
export const ApkInstaller: ApkInstallerPlugin = {
  async downloadAndInstall(options) {
    const url = assertAllowedApkDownloadUrl(options.url);
    await native.downloadAndInstall({ url });
  },
};

/** Reject do nativo quando canRequestPackageInstalls() é false. */
export function isUnknownSourcesError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";
  const lower = message.toLowerCase();
  return (
    lower.includes("fontes desconhecidas") ||
    lower.includes("unknown sources") ||
    lower.includes("unknown app sources")
  );
}
