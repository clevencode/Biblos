/**
 * Banner de instalação híbrido:
 * - Android web → download APK (não A2HS / beforeinstallprompt CTA)
 * - iOS web → hint « Ajouter à l’écran d’accueil »
 * - Capacitor / standalone / desktop → hidden
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

export type PwaInstallMode = "hidden" | "apk-download" | "ios-hint";

export type PwaInstallState = {
  mode: PwaInstallMode;
  canInstall: boolean;
  busy: boolean;
  install: () => Promise<void>;
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

export function usePwaInstall(): PwaInstallState {
  const [dismissed, setDismissed] = useState(readDismissedSync);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(isStandaloneDisplay);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    // Bloqueia o mini-infobar PWA do Chrome; não usamos o evento como CTA.
    const onBip = (event: Event) => {
      event.preventDefault();
    };
    const onDisplayChange = () => setStandalone(isStandaloneDisplay());

    window.addEventListener("beforeinstallprompt", onBip);
    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;
    mq?.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
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

  const install = useCallback(async () => {
    if (busy) return;
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
  }, [busy, standalone]);

  let mode: PwaInstallMode = "hidden";
  if (!Capacitor.isNativePlatform() && !standalone && !dismissed) {
    if (isAndroidBrowser()) mode = "apk-download";
    else if (isIosSafariFamily()) mode = "ios-hint";
  }

  return {
    mode,
    canInstall: mode === "apk-download",
    busy,
    install,
    dismiss,
  };
}
