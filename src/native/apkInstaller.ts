import { registerPlugin } from "@capacitor/core";

export type ApkInstallerPlugin = {
  downloadAndInstall(options: { url: string }): Promise<void>;
};

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");

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
