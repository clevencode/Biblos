import {
  getStorageAdapter,
  STORAGE_PREF_KEYS,
} from "./services/storage/StorageAdapter";
import { wipeLocalUserData } from "./userProfile";

/** Une seule fois par jeton : oublie données/caches utilisateurs pour repartir propre. */
const CLEAN_SLATE_KEY = STORAGE_PREF_KEYS.cleanSlate;
const CLEAN_SLATE_TOKEN = `official-${__APP_VERSION__}`;

/** Caches Workbox / PWA — limpar no bump de versão sem desregistrar o SW intencional. */
async function clearHttpCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

/**
 * Remove apenas SWs legados (não-workbox/biblos). O SW do vite-plugin-pwa
 * permanece para updates com prompt.
 */
async function unregisterLegacyServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.map(async (reg) => {
      const scriptUrl =
        reg.active?.scriptURL ||
        reg.waiting?.scriptURL ||
        reg.installing?.scriptURL ||
        "";
      const keep =
        scriptUrl.includes("sw.js") ||
        scriptUrl.includes("workbox") ||
        scriptUrl.includes("dev-sw");
      if (!keep) {
        try {
          await reg.unregister();
        } catch {
          /* ignore */
        }
      }
    }),
  );
}

async function deleteOfflineDatabases(): Promise<void> {
  if (!("indexedDB" in window) || typeof indexedDB.databases !== "function") {
    try {
      indexedDB.deleteDatabase("biblos-s21-offline");
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs
        .map((db) => db.name)
        .filter((name): name is string => Boolean(name?.toLowerCase().includes("biblos")))
        .map(
          (name) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            }),
        ),
    );
  } catch {
    try {
      indexedDB.deleteDatabase("biblos-s21-offline");
    } catch {
      /* ignore */
    }
  }
}

function readCleanSlateTokenSync(): string | null {
  try {
    return localStorage.getItem(CLEAN_SLATE_KEY);
  } catch {
    return null;
  }
}

/**
 * Wipe in-place no bump de versão — sem `location.replace` / duplo boot.
 * @returns sempre false (compat signature; nunca dispara reload).
 */
export async function ensureCleanSlate(): Promise<boolean> {
  const store = getStorageAdapter();
  let current = readCleanSlateTokenSync();
  if (current == null) {
    current = await store.getString(CLEAN_SLATE_KEY);
  }

  if (current === CLEAN_SLATE_TOKEN) {
    return false;
  }

  await wipeLocalUserData();
  await deleteOfflineDatabases();
  await clearHttpCaches();
  await unregisterLegacyServiceWorkers();

  try {
    localStorage.setItem(CLEAN_SLATE_KEY, CLEAN_SLATE_TOKEN);
  } catch {
    /* private mode */
  }
  await store.setString(CLEAN_SLATE_KEY, CLEAN_SLATE_TOKEN);

  // Limpa query legado ?fresh=1 de boots antigos.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("fresh")) {
      url.searchParams.delete("fresh");
      const clean = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", clean || "/");
    }
  } catch {
    /* ignore */
  }

  return false;
}
