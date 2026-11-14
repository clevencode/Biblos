/**
 * Instalação PWA: beforeinstallprompt + iOS hint + exclusão Capacitor/standalone.
 */

import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useState } from "react";
import {
  getStorageAdapter,
  STORAGE_PREF_KEYS,
} from "../services/storage/StorageAdapter";

const DISMISS_KEY = STORAGE_PREF_KEYS.pwaInstallDismissed;
const DISMISS_VALUE = "1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallMode = "hidden" | "prompt" | "ios-hint";

export type PwaInstallState = {
  mode: PwaInstallMode;
  canInstall: boolean;
  busy: boolean;
  install: () => Promise<void>;
  dismiss: () => void;
};

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

function isIosSafariFamily(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  // Chrome/Firefox iOS also lack beforeinstallprompt — same A2HS path.
  return true;
}

function readDismissedSync(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === DISMISS_VALUE;
  } catch {
    return false;
  }
}

export function usePwaInstall(): PwaInstallState {
  const [dismissed, setDismissed] = useState(readDismissedSync);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(isStandaloneDisplay);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try {
        localStorage.setItem(DISMISS_KEY, DISMISS_VALUE);
      } catch {
        /* ignore */
      }
      void getStorageAdapter().setString(DISMISS_KEY, DISMISS_VALUE);
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

  const install = useCallback(async () => {
    if (!deferred || busy) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setDeferred(null);
      }
    } catch (error) {
      console.warn("[pwa] install prompt failed", error);
    } finally {
      setBusy(false);
    }
  }, [deferred, busy]);

  let mode: PwaInstallMode = "hidden";
  if (
    !Capacitor.isNativePlatform() &&
    !standalone &&
    !installed &&
    !dismissed
  ) {
    if (deferred) mode = "prompt";
    else if (isIosSafariFamily()) mode = "ios-hint";
  }

  return {
    mode,
    canInstall: mode === "prompt",
    busy,
    install,
    dismiss,
  };
}
