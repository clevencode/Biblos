import { normalizeVerseColor } from "./verseColors";

const STORAGE_KEY = "biblos.verseMarks";

/** Clé chapitre → map verset → couleur hex. */
export type VerseMarkStore = Record<string, Record<string, string>>;

function chapterKey(bookId: string, chapterId: string): string {
  return `${bookId.toUpperCase()}.${String(chapterId)}`;
}

function readStore(): VerseMarkStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as VerseMarkStore;
  } catch {
    return {};
  }
}

function writeStore(store: VerseMarkStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function loadChapterMarks(
  bookId: string,
  chapterId: string,
): ReadonlyMap<number, string> {
  const chapter = readStore()[chapterKey(bookId, chapterId)] ?? {};
  const map = new Map<number, string>();
  for (const [verse, hex] of Object.entries(chapter)) {
    const n = Number(verse);
    if (!Number.isFinite(n) || n < 1) continue;
    map.set(n, normalizeVerseColor(hex));
  }
  return map;
}

export function setVerseMarks(
  bookId: string,
  chapterId: string,
  verses: readonly number[],
  color: string | null,
): ReadonlyMap<number, string> {
  const key = chapterKey(bookId, chapterId);
  const store = readStore();
  const chapter = { ...(store[key] ?? {}) };
  const hex = color ? normalizeVerseColor(color) : null;
  for (const verse of verses) {
    if (!Number.isFinite(verse) || verse < 1) continue;
    const id = String(verse);
    if (hex) chapter[id] = hex;
    else delete chapter[id];
  }
  if (Object.keys(chapter).length) store[key] = chapter;
  else delete store[key];
  writeStore(store);
  return loadChapterMarks(bookId, chapterId);
}
