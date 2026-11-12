/**
 * Service Worker updates — web only, prompt (sem reload automático no meio da leitura).
 */

import { Capacitor } from "@capacitor/core";

export type SwUpdateListener = (hasPending: boolean) => void;

let hasPendingUpdate = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<SwUpdateListener>();

function notify() {
  for (const listener of listeners) {
    try {
      listener(hasPendingUpdate);
    } catch {
      /* ignore */
    }
  }
}

export function getHasPendingSwUpdate(): boolean {
  return hasPendingUpdate;
}

export function subscribeSwUpdate(listener: SwUpdateListener): () => void {
  listeners.add(listener);
  listener(hasPendingUpdate);
  return () => {
    listeners.delete(listener);
  };
}

/** Aplica a atualização pendente (reload só após gesto do utilizador). */
export async function applyPendingSwUpdate(): Promise<boolean> {
  if (!hasPendingUpdate || !updateSW) return false;
  hasPendingUpdate = false;
  notify();
  await updateSW(true);
  return true;
}

/**
 * Registra o SW via virtual module do vite-plugin-pwa.
 * No-op em Capacitor nativo.
 */
export async function bootSwUpdateManager(): Promise<void> {
  if (Capacitor.isNativePlatform()) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const { registerSW } = await import("virtual:pwa-register");
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        hasPendingUpdate = true;
        notify();
      },
      onOfflineReady() {
        /* shell precache pronto — Bíblias continuam no IndexedDB */
      },
    });
  } catch {
    /* plugin ausente em alguns modos */
  }
}
