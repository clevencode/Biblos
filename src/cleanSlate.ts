import {
  getStorageAdapter,
  STORAGE_PREF_KEYS,
} from "./services/storage/StorageAdapter";

/**
 * Token por versão — já não faz wipe de dados de utilizador / logout.
 * Só limpa caches HTTP e SWs legados; preserva sessão, marks e planos.
 */
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

function readCleanSlateTokenSync(): string | null {
  try {
    return localStorage.getItem(CLEAN_SLATE_KEY);
  } catch {
    return null;
  }
}

/**
 * Soft bump de versão — sem signOut, sem wipe de marks/planos/perfil.
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

  await clearHttpCaches();
  await unregisterLegacyServiceWorkers();

  try {
    localStorage.setItem(CLEAN_SLATE_KEY, CLEAN_SLATE_TOKEN);
  } catch {
    /* private mode */
  }
  await store.setString(CLEAN_SLATE_KEY, CLEAN_SLATE_TOKEN);

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
