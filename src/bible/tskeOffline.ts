/**
 * Pack offline TSKE — assets `/bible/study/tske/` (sem seed IndexedDB).
 */

import { isTskeOfflineReady } from "./idbTskeCache";

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
 * Assets-first: confirma manifest; capítulos leem-se sob demanda via fetch.
 */
export async function ensureTskeOfflinePack(
  onProgress?: (p: TskeOfflineProgress) => void,
  options?: { force?: boolean },
): Promise<{ count: number; total: number }> {
  if (!options?.force && (await isTskeOfflineReady())) {
    const files = await loadTskeManifest();
    return { count: files.length, total: files.length };
  }
  return downloadTskeOfflinePack(onProgress);
}

/** Confirma assets TSKE (sem gravar IndexedDB). */
export async function downloadTskeOfflinePack(
  onProgress?: (p: TskeOfflineProgress) => void,
): Promise<{ count: number; total: number }> {
  const files = await loadTskeManifest();
  if (!files.length) {
    throw new Error("Manifest TSKE indisponible");
  }
  const total = files.length;
  onProgress?.({ done: 0, total, key: files[0] ?? "" });
  // Probe do primeiro capítulo — restante sob demanda.
  const first = files[0]!;
  const json = await fetchChapterJson(first);
  if (!json || !parseKey(first)) {
    throw new Error("Pack TSKE indisponible (assets)");
  }
  onProgress?.({ done: total, total, key: first });
  return { count: total, total };
}
