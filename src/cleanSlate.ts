import { wipeLocalUserData } from "./userProfile";

/** Une seule fois par jeton : oublie données/caches utilisateurs pour repartir propre. */
const CLEAN_SLATE_KEY = "biblos-clean-slate";
const CLEAN_SLATE_TOKEN = `official-${__APP_VERSION__}`;

async function clearHttpCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function unregisterServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
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

/**
 * Efface caches + données locales obsolètes, puis recharge une fois à froid.
 * @returns true si une navigation de rechargement a été déclenchée.
 */
export async function ensureCleanSlate(): Promise<boolean> {
  let current: string | null = null;
  try {
    current = localStorage.getItem(CLEAN_SLATE_KEY);
  } catch {
    current = null;
  }

  const url = new URL(window.location.href);
  const isFreshBoot = url.searchParams.get("fresh") === "1";

  if (current === CLEAN_SLATE_TOKEN && !isFreshBoot) {
    return false;
  }

  if (current !== CLEAN_SLATE_TOKEN) {
    await wipeLocalUserData();
    await deleteOfflineDatabases();
    await clearHttpCaches();
    await unregisterServiceWorkers();
    try {
      localStorage.setItem(CLEAN_SLATE_KEY, CLEAN_SLATE_TOKEN);
    } catch {
      /* private mode */
    }
  }

  if (!isFreshBoot) {
    url.searchParams.set("fresh", "1");
    window.location.replace(url.toString());
    return true;
  }

  url.searchParams.delete("fresh");
  const clean = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", clean || "/");
  return false;
}
