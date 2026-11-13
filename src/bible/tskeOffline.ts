/**
 * Pack offline TSKE — descarga a partir do manifest embutido e grava no IndexedDB.
 */

import {
  putTskeChaptersBulk,
  writeTskePackMeta,
  isTskeOfflineReady,
} from "./idbTskeCache";

export type TskeOfflineProgress = {
  done: number;
  total: number;
  key: string;
};

type TskeManifest = {
  files?: string[];
};

type TskeChapterJson = Record<
  string,
  { heading?: string; body?: string; refs?: string[] }
>;

const MANIFEST_URL = "/bible/study/tske/manifest.json";

function chapterUrl(key: string): string {
  return `/bible/study/tske/${encodeURIComponent(key)}.json`;
}

function parseKey(key: string): { bookId: string; chapter: number } | null {
  const m = String(key || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]+)\.(\d+)$/);
  if (!m) return null;
  return { bookId: m[1]!, chapter: Number(m[2]) };
}

async function fetchChapterJson(key: string): Promise<TskeChapterJson | null> {
  try {
    const res = await fetch(chapterUrl(key));
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    if (!raw || raw.startsWith("<")) return null;
    const json = JSON.parse(raw) as TskeChapterJson;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

export async function loadTskeManifest(): Promise<string[]> {
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) return [];
    const raw = (await res.text()).trim();
    if (!raw || raw.startsWith("<")) return [];
    const json = JSON.parse(raw) as TskeManifest;
    return Array.isArray(json.files)
      ? json.files.map((f) => String(f).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

/**
 * Garante o pack TSKE no IndexedDB (idempotente se já `complete`).
 * Usa os JSON embutidos em `/bible/study/tske/` (web, PWA ou Capacitor).
 */
export async function ensureTskeOfflinePack(
  onProgress?: (p: TskeOfflineProgress) => void,
  options?: { force?: boolean },
): Promise<{ count: number; total: number }> {
  if (!options?.force && (await isTskeOfflineReady())) {
    return { count: 0, total: 0 };
  }
  return downloadTskeOfflinePack(onProgress);
}

/** Descarga todos os capítulos do manifest para o IndexedDB. */
export async function downloadTskeOfflinePack(
  onProgress?: (p: TskeOfflineProgress) => void,
): Promise<{ count: number; total: number }> {
  const files = await loadTskeManifest();
  if (!files.length) {
    throw new Error("Manifest TSKE indisponible");
  }

  const total = files.length;
  let done = 0;
  const concurrency = 8;
  let cursor = 0;
  const collected: Array<{
    bookId: string;
    chapter: number;
    data: TskeChapterJson;
  }> = [];

  async function worker() {
    while (cursor < files.length) {
      const index = cursor++;
      const key = files[index]!;
      const parsed = parseKey(key);
      const json = await fetchChapterJson(key);
      if (parsed && json) {
        collected.push({
          bookId: parsed.bookId,
          chapter: parsed.chapter,
          data: json,
        });
      }
      done += 1;
      onProgress?.({ done, total, key });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, () => worker()),
  );

  const CHUNK = 64;
  for (let i = 0; i < collected.length; i += CHUNK) {
    await putTskeChaptersBulk(collected.slice(i, i + CHUNK));
  }

  const okCount = collected.length;
  const complete = okCount > 0 && okCount >= Math.floor(total * 0.95);
  await writeTskePackMeta(okCount, total, complete);
  if (!complete) {
    throw new Error(
      `Pack TSKE incomplet (${okCount}/${total}) — refs croisées hors ligne partielles`,
    );
  }
  return { count: okCount, total };
}
