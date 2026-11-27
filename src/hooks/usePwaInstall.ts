/**
 * Instalação híbrida:
 * - Banner → só install do navegador (beforeinstallprompt) ou hint iOS
 * - Menu → download APK (Android) / hint iOS
 * - Capacitor / standalone → hidden
 */

import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useState } from "react";
import {
  getStorageAdapter,
  STORAGE_PREF_KEYS,
} from "../services/storage/StorageAdapter";

const DISMISS_KEY = STORAGE_PREF_KEYS.apkBannerDismissed;
const DISMISS_VALUE = "1";

const DEFAULT_APK_URL = "/downloads/biblos.apk";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Banner: nunca `apk-download`. */
export type PwaInstallBannerMode = "hidden" | "browser-install" | "ios-hint";

/** Menu: APK ou hint iOS. */
export type PwaInstallMenuMode = "hidden" | "apk-download" | "ios-hint";

export type PwaInstallMode = PwaInstallBannerMode | "apk-download";

/**
 * Profil › À propos: oferta persistente (ignora o dismiss do banner).
 * `installed` = standalone / app nativa.
 */
export type PwaInstallAboutMode =
  | "installed"
  | "browser-install"
  | "apk-download"
  | "ios-hint"
  | "unavailable";

export type PwaInstallState = {
  /** Banner (ignora APK). */
  mode: PwaInstallBannerMode;
  /** Menu: oferta da plataforma (APK / iOS), ignora dismiss do banner. */
  menuMode: PwaInstallMenuMode;
  /** À propos: sempre visível, sem dismiss. */
  aboutMode: PwaInstallAboutMode;
  canInstall: boolean;
  busy: boolean;
  /**
   * `banner` → prompt A2HS; `menu` → APK no Android (mesmo com bip disponível).
   */
  install: (opts?: { source?: "banner" | "menu" }) => Promise<void>;
  dismiss: () => void;
};

function apkDownloadUrl(): string {
  const raw = String(import.meta.env.VITE_APK_DOWNLOAD_URL ?? "").trim();
  return raw || DEFAULT_APK_URL;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (typeof window.matchMedia !== "function") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

function isAndroidBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isIosSafariFamily(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function resolveMenuMode(
  standalone: boolean,
  allowApkDownload: boolean,
): PwaInstallMenuMode {
  if (Capacitor.isNativePlatform() || standalone) return "hidden";
  if (isAndroidBrowser()) return allowApkDownload ? "apk-download" : "hidden";
  if (isIosSafariFamily()) return "ios-hint";
  return "hidden";
}

function readDismissedSync(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === DISMISS_VALUE;
  } catch {
    return false;
  }
}

function triggerApkDownload(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", "biblos.apk");
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export type UsePwaInstallOptions = {
  /** APK no menu — só admin (`isClevencodeAdminEmail`). Default: false. */
  allowApkDownload?: boolean;
};

export function usePwaInstall(
  options: UsePwaInstallOptions = {},
): PwaInstallState {
  const allowApkDownload = Boolean(options.allowApkDownload);
  const [dismissed, setDismissed] = useState(readDismissedSync);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(isStandaloneDisplay);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setStandalone(true);
    };
    const onDisplayChange = () => setStandalone(isStandaloneDisplay());

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;
    mq?.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener("change", onDisplayChange);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, DISMISS_VALUE);
    } catch {
      /* ignore */
    }
    void getStorageAdapter().setString(DISMISS_KEY, DISMISS_VALUE);
  }, []);

  const menuMode = resolveMenuMode(standalone, allowApkDownload);

  const aboutMode: PwaInstallAboutMode = (() => {
    if (Capacitor.isNativePlatform() || standalone) return "installed";
    if (deferredPrompt) return "browser-install";
    if (menuMode === "apk-download") return "apk-download";
    if (isIosSafariFamily()) return "ios-hint";
    return "unavailable";
  })();

  const mode: PwaInstallBannerMode = (() => {
    if (dismissed || Capacitor.isNativePlatform() || standalone) {
      return "hidden";
    }
    if (deferredPrompt) return "browser-install";
    if (isIosSafariFamily()) return "ios-hint";
    return "hidden";
  })();

  const install = useCallback(
    async (opts?: { source?: "banner" | "menu" }) => {
      if (busy) return;
      const source = opts?.source ?? "banner";

      const downloadApk = async () => {
        if (!allowApkDownload) return;
        if (!isAndroidBrowser() || Capacitor.isNativePlatform() || standalone) {
          return;
        }
        setBusy(true);
        try {
          triggerApkDownload(apkDownloadUrl());
        } catch (error) {
          console.warn("[apk] download failed", error);
          try {
            window.location.assign(apkDownloadUrl());
          } catch {
            /* ignore */
          }
        } finally {
          setBusy(false);
        }
      };

      if (source === "menu") {
        await downloadApk();
        return;
      }

      if (deferredPrompt) {
        setBusy(true);
        try {
          await deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          setDeferredPrompt(null);
        } catch (error) {
          console.warn("[pwa] install prompt failed", error);
        } finally {
          setBusy(false);
        }
        return;
      }

      await downloadApk();
    },
    [allowApkDownload, busy, deferredPrompt, standalone],
  );

  return {
    mode,
    menuMode,
    aboutMode,
    canInstall: mode === "browser-install" || menuMode === "apk-download",
    busy,
    install,
    dismiss,
  };
}
