/**
 * Pack de 1.ª visita — deprecated (assets-first).
 * Conteúdo S21/HT98/TSKE vem dos assets do APK / Cache Storage na PWA.
 * Mantido como no-op para callers legados.
 */

import { Capacitor } from "@capacitor/core";
import { isOfflineBibleReady } from "../bibleOffline";
import { isHt1998OfflineReady } from "../bible/ht1998Offline";
import { isTskeOfflineReady } from "../bible/idbTskeCache";
import {
  getStorageAdapter,
  STORAGE_PREF_KEYS,
} from "../services/storage/StorageAdapter";

export type FirstInstallPhase = "s21" | "ht98" | "tske" | "plans" | "done";

export type FirstInstallProgress = {
  phase: FirstInstallPhase;
  done: number;
  total: number;
  key?: string;
};

const LS_KEY = STORAGE_PREF_KEYS.firstInstallPack;
const LS_DONE = "v1-complete";

export function readFirstInstallPackFlag(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === LS_DONE;
  } catch {
    return false;
  }
}

export function writeFirstInstallPackFlag(): void {
  try {
    localStorage.setItem(LS_KEY, LS_DONE);
  } catch {
    /* ignore */
  }
  void getStorageAdapter().setString(LS_KEY, LS_DONE);
}

/** Assets-first: nativo sempre pronto; web se os três probes passarem. */
export async function isFirstInstallPackReady(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    writeFirstInstallPackFlag();
    return true;
  }
  if (readFirstInstallPackFlag()) return true;
  const [s21, ht, tske] = await Promise.all([
    isOfflineBibleReady(),
    isHt1998OfflineReady(),
    isTskeOfflineReady(),
  ]);
  if (s21 && ht && tske) {
    writeFirstInstallPackFlag();
    return true;
  }
  return false;
}

/** No-op: marca pack completo (sem download IDB). */
export async function runFirstInstallPack(
  onProgress?: (p: FirstInstallProgress) => void,
): Promise<void> {
  onProgress?.({ phase: "done", done: 1, total: 1 });
  writeFirstInstallPackFlag();
}
