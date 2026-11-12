/**
 * StorageManager — proteção do IndexedDB e diagnóstico de quota.
 */

export type StorageHealth = {
  usedMB: number;
  quotaMB: number;
  isPersisted: boolean;
};

function bytesToMb(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes < 0) return 0;
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function hasStorageManager(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage === "object" &&
    navigator.storage != null
  );
}

/** Solicita armazenamento persistente (protege IndexedDB contra eviction). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!hasStorageManager()) return false;
  try {
    if (typeof navigator.storage.persisted === "function") {
      const already = await navigator.storage.persisted();
      if (already) return true;
    }
    if (typeof navigator.storage.persist === "function") {
      return Boolean(await navigator.storage.persist());
    }
  } catch {
    /* private mode / unsupported */
  }
  return false;
}

/** Diagnóstico de uso/quota para a aba Profil. */
export async function getStorageHealth(): Promise<StorageHealth> {
  const fallback: StorageHealth = {
    usedMB: 0,
    quotaMB: 0,
    isPersisted: false,
  };
  if (!hasStorageManager()) return fallback;

  let isPersisted = false;
  try {
    if (typeof navigator.storage.persisted === "function") {
      isPersisted = Boolean(await navigator.storage.persisted());
    }
  } catch {
    isPersisted = false;
  }

  try {
    if (typeof navigator.storage.estimate !== "function") {
      return { ...fallback, isPersisted };
    }
    const estimate = await navigator.storage.estimate();
    return {
      usedMB: bytesToMb(Number(estimate.usage ?? 0)),
      quotaMB: bytesToMb(Number(estimate.quota ?? 0)),
      isPersisted,
    };
  } catch {
    return { ...fallback, isPersisted };
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number; message?: string };
  if (e.name === "QuotaExceededError") return true;
  if (e.code === 22) return true;
  const msg = String(e.message || "").toLowerCase();
  return msg.includes("quota") || msg.includes("storage");
}
