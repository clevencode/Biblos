/**
 * Pack de 1.ª visita — S21 + HT98 + TSKE + warm planos.
 * O cartão UI reutiliza `.sw-update-banner`.
 */

import { Capacitor } from "@capacitor/core";
import { buildS21BookList } from "../bibleS21Canon";
import {
  downloadOfflineBible,
  isOfflineBibleReady,
  seedOfflineBibleFromBundledAssets,
} from "../bibleOffline";
import {
  downloadHt1998Offline,
  isHt1998OfflineReady,
} from "../bible/ht1998Offline";
import {
  ensureTskeOfflinePack,
} from "../bible/tskeOffline";
import { isTskeOfflineReady } from "../bible/idbTskeCache";

export type FirstInstallPhase = "s21" | "ht98" | "tske" | "plans" | "done";

export type FirstInstallProgress = {
  phase: FirstInstallPhase;
  done: number;
  total: number;
  key?: string;
};

const LS_KEY = "biblos-first-install-pack";
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
}

/** Conteúdo offline crítico pronto (versões + refs). */
export async function isFirstInstallPackReady(): Promise<boolean> {
  if (readFirstInstallPackFlag()) {
    const [s21, ht, tske] = await Promise.all([
      isOfflineBibleReady(),
      isHt1998OfflineReady(),
      isTskeOfflineReady(),
    ]);
    if (s21 && ht && tske) return true;
    // Flag stale (dados limpos) — forçar de novo.
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }
  const [s21, ht, tske] = await Promise.all([
    isOfflineBibleReady(),
    isHt1998OfflineReady(),
    isTskeOfflineReady(),
  ]);
  return s21 && ht && tske;
}

async function installS21(
  onProgress?: (p: FirstInstallProgress) => void,
): Promise<void> {
  if (await isOfflineBibleReady()) return;
  const list = buildS21BookList();
  const report = (done: number, total: number, usfm: string) => {
    onProgress?.({ phase: "s21", done, total, key: usfm });
  };

  // Preferir assets embutidos (web stage / Capacitor) — sem API.
  try {
    await seedOfflineBibleFromBundledAssets(list, report);
    return;
  } catch {
    if (Capacitor.isNativePlatform()) throw new Error("Assets S21 manquants");
  }
  await downloadOfflineBible(list, (p) =>
    report(p.done, p.total, p.usfm),
  );
}

async function prefetchReadingPlans(
  onProgress?: (p: FirstInstallProgress) => void,
): Promise<void> {
  onProgress?.({ phase: "plans", done: 0, total: 1 });
  const { isReadingPlansFirebaseConfigured } = await import(
    "../features/reading-plans"
  );
  if (!isReadingPlansFirebaseConfigured()) {
    onProgress?.({ phase: "plans", done: 1, total: 1 });
    return;
  }
  const { warmupReadingPlansRepository, subscribePublishedReadingPlans } =
    await import("../features/reading-plans/data/readingPlansRepository");
  await warmupReadingPlansRepository();

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
      resolve();
    };
    const timer = window.setTimeout(finish, 12_000);
    const unsub = subscribePublishedReadingPlans({
      onData: () => finish(),
      onError: () => finish(),
    });
    if (!unsub) finish();
  });

  onProgress?.({ phase: "plans", done: 1, total: 1 });
}

/**
 * Instala tudo para uso hors ligne na 1.ª visita.
 * Idempotente nas fases já completas.
 */
export async function runFirstInstallPack(
  onProgress?: (p: FirstInstallProgress) => void,
): Promise<void> {
  onProgress?.({ phase: "s21", done: 0, total: 66 });
  await installS21(onProgress);

  onProgress?.({ phase: "ht98", done: 0, total: 2 });
  if (!(await isHt1998OfflineReady())) {
    await downloadHt1998Offline((p) =>
      onProgress?.({
        phase: "ht98",
        done: p.done,
        total: p.total,
        key: p.phase,
      }),
    );
  } else {
    onProgress?.({ phase: "ht98", done: 2, total: 2 });
  }

  onProgress?.({ phase: "tske", done: 0, total: 1 });
  if (!(await isTskeOfflineReady())) {
    await ensureTskeOfflinePack((p) =>
      onProgress?.({
        phase: "tske",
        done: p.done,
        total: p.total,
        key: p.key,
      }),
    );
  } else {
    onProgress?.({ phase: "tske", done: 1, total: 1 });
  }

  await prefetchReadingPlans(onProgress);

  writeFirstInstallPackFlag();
  onProgress?.({ phase: "done", done: 1, total: 1 });
}
