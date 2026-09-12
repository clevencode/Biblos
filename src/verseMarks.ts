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

export type SavedVerseMark = {
  bookId: string;
  chapterId: string;
  verse: number;
  color: string;
  /** Clé stable pour React. */
  key: string;
  /** Affichage court (ex. JHN 3.16). */
  label: string;
};

/** Tous les versets marqués (local), du plus récent chapitre en dernier. */
export function listAllVerseMarks(): SavedVerseMark[] {
  const store = readStore();
  const out: SavedVerseMark[] = [];
  for (const [chapter, verses] of Object.entries(store)) {
    const dot = chapter.indexOf(".");
    if (dot < 1) continue;
    const bookId = chapter.slice(0, dot).toUpperCase();
    const chapterId = chapter.slice(dot + 1);
    if (!bookId || !chapterId) continue;
    for (const [verseRaw, hex] of Object.entries(verses ?? {})) {
      const verse = Number(verseRaw);
      if (!Number.isFinite(verse) || verse < 1) continue;
      const color = normalizeVerseColor(hex);
      out.push({
        bookId,
        chapterId,
        verse,
        color,
        key: `${bookId}.${chapterId}.${verse}`,
        label: `${bookId} ${chapterId}.${verse}`,
      });
    }
  }
  return out.sort((a, b) => {
    const byBook = a.bookId.localeCompare(b.bookId, "fr");
    if (byBook !== 0) return byBook;
    const byChapter = Number(a.chapterId) - Number(b.chapterId);
    if (byChapter !== 0) return byChapter;
    return a.verse - b.verse;
  });
}
