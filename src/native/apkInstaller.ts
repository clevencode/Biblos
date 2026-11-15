import { registerPlugin } from "@capacitor/core";

export type ApkInstallerPlugin = {
  downloadAndInstall(options: { url: string }): Promise<void>;
};

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");
