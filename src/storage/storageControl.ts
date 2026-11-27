/**
 * Controlo de armazenamento e cache (Profil › Stockage).
 *
 * - Uso / quota do navegador (StorageManager), com detalhe por tipo quando
 *   o navegador o expõe (`usageDetails`: Cache Storage vs IndexedDB).
 * - Estado offline das Bíblias (web: Cache Storage do service worker;
 *   APK: incluídas na app).
 * - « Vider le cache »: apaga só caches de leitura (Bíblias, refs cruzadas)
 *   e índices em memória. Nunca toca em dados pessoais (marcas, notas,
 *   planos, histórico) nem na app em si (precache do service worker).
 */

import { Capacitor } from "@capacitor/core";
import { OFFLINE_BOOK_TOTAL } from "../bibleOffline";
import { requestPersistentStorage } from "../offlineStorageGuard";

/** Caches de leitura do service worker (ver vite.config.ts → runtimeCaching). */
export const READING_CACHE_NAMES = [
  "biblos-s21-json",
  "biblos-ht98-json",
  "biblos-tske-json",
] as const;

export type StorageReport = {
  /** Bytes usados pela app no navegador (null = indisponível). */
  usedBytes: number | null;
  quotaBytes: number | null;
  /** Cache Storage (Bíblias, app offline) — só se o navegador detalhar. */
  cachesBytes: number | null;
  /** IndexedDB (índice de pesquisa, cache de sincronização). */
  indexedDbBytes: number | null;
  /** Protegido contra limpeza automática do navegador. */
  persisted: boolean;
  /** O navegador permite pedir proteção. */
  canPersist: boolean;
  /** Bíblias incluídas no pacote (APK): sempre offline. */
  bundled: boolean;
  /** Livros S21 guardados para leitura offline (web). */
  s21Books: number;
  s21Total: number;
  /** HAT98 guardada para leitura offline (web). */
  ht98Ready: boolean;
  /** Bytes que « Vider le cache » liberta (estimativa; null = desconhecido). */
  readingCacheBytes: number | null;
};

type UsageDetails = Partial<Record<"caches" | "indexedDB" | "serviceWorkerRegistrations", number>>;

function hasCaches(): boolean {
  return typeof caches !== "undefined";
}

async function cacheEntries(name: string): Promise<readonly Request[]> {
  if (!hasCaches()) return [];
  try {
    if (!(await caches.has(name))) return [];
    return await (await caches.open(name)).keys();
  } catch {
    return [];
  }
}

/** Soma o tamanho declarado das respostas (Content-Length) de uma cache. */
async function cacheBytes(name: string): Promise<number | null> {
  if (!hasCaches()) return null;
  try {
    if (!(await caches.has(name))) return 0;
    const cache = await caches.open(name);
    let total = 0;
    let known = true;
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      const length = Number(response?.headers.get("content-length"));
      if (Number.isFinite(length) && length > 0) total += length;
      else known = false;
    }
    return known || total > 0 ? total : null;
  } catch {
    return null;
  }
}

function countS21Books(requests: readonly Request[]): number {
  const books = new Set<string>();
  for (const request of requests) {
    const match = /\/bible\/s21\/books\/([^/?#]+)\.json/i.exec(request.url);
    if (match?.[1]) books.add(match[1].toUpperCase());
  }
  return books.size;
}

export async function readStorageReport(): Promise<StorageReport> {
  const bundled = Capacitor.isNativePlatform();
  const storage =
    typeof navigator !== "undefined" ? navigator.storage : undefined;

  let usedBytes: number | null = null;
  let quotaBytes: number | null = null;
  let cachesBytes: number | null = null;
  let indexedDbBytes: number | null = null;
  try {
    const estimate = (await storage?.estimate?.()) as
      | (StorageEstimate & { usageDetails?: UsageDetails })
      | undefined;
    if (estimate) {
      usedBytes = Number(estimate.usage ?? 0);
      quotaBytes = Number(estimate.quota ?? 0) || null;
      const details = estimate.usageDetails;
      if (details) {
        cachesBytes = Number(details.caches ?? 0);
        indexedDbBytes = Number(details.indexedDB ?? 0);
      }
    }
  } catch {
    /* navegador sem StorageManager */
  }

  let persisted = false;
  try {
    persisted = Boolean(await storage?.persisted?.());
  } catch {
    persisted = false;
  }

  const [s21Requests, ht98Requests, ...readingSizes] = await Promise.all([
    cacheEntries("biblos-s21-json"),
    cacheEntries("biblos-ht98-json"),
    ...READING_CACHE_NAMES.map(cacheBytes),
  ]);
  const readingCacheBytes = readingSizes.every((n) => n == null)
    ? null
    : readingSizes.reduce<number>((sum, n) => sum + (n ?? 0), 0);

  return {
    usedBytes,
    quotaBytes,
    cachesBytes,
    indexedDbBytes,
    persisted: bundled || persisted,
    canPersist: !bundled && typeof storage?.persist === "function",
    bundled,
    s21Books: bundled ? OFFLINE_BOOK_TOTAL : countS21Books(s21Requests),
    s21Total: OFFLINE_BOOK_TOTAL,
    ht98Ready: bundled || ht98Requests.length > 0,
    readingCacheBytes,
  };
}

/** Pede ao navegador para não apagar automaticamente os dados da app. */
export async function protectStorage(): Promise<boolean> {
  return requestPersistentStorage();
}

/**
 * Apaga os caches de leitura (Bíblias offline, refs cruzadas) e invalida os
 * índices em memória. Dados pessoais e a app em si ficam intactos; as
 * Bíblias voltam a ser guardadas à medida que se lê (ou via « Télécharger »).
 */
export async function clearReadingCache(): Promise<void> {
  if (hasCaches()) {
    await Promise.all(
      READING_CACHE_NAMES.map((name) => caches.delete(name).catch(() => false)),
    );
  }
  const [{ clearOfflineBible }, { clearHt1998Offline }, { invalidateSearchIndexInWorker }] =
    await Promise.all([
      import("../bibleOffline"),
      import("../bible/ht1998Offline"),
      import("../bible/verseSearchClient"),
    ]);
  await Promise.all([clearOfflineBible(), clearHt1998Offline()]);
  invalidateSearchIndexInWorker("s21");
}

/** « 12,4 Mo » / « 1,2 Go » no locale da UI. */
export function formatBytes(bytes: number, localeTag: string): string {
  const mb = bytes / (1024 * 1024);
  const fmt = (value: number, unit: string) =>
    `${new Intl.NumberFormat(localeTag, {
      maximumFractionDigits: value < 10 ? 1 : 0,
    }).format(value)} ${unit}`;
  if (mb >= 1024) return fmt(mb / 1024, "Go");
  if (mb >= 0.1) return fmt(mb, "Mo");
  return fmt(bytes / 1024, "Ko");
}
