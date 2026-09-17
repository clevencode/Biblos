import { isVerseMarkCard } from "./catalog";
import type { Flashcard } from "./types";
import { normalizeVerseColor, parseVerseHex } from "./verseColors";

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

/** Parse usfm + color depuis le corps Notion d’un VerseMark. */
export function parseVerseMarkMeta(verso: string | null | undefined): {
  usfm: string | null;
  color: string | null;
} {
  const text = String(verso || "");
  const usfmMatch = text.match(/usfm:([A-Z0-9.-]+)/i);
  const colorMatch = text.match(/color:(#[0-9a-fA-F]{3,8})/i);
  const bareHex = parseVerseHex(text.trim().split(/\s+/)[0] || "");
  return {
    usfm: usfmMatch?.[1]?.toUpperCase() ?? null,
    color: colorMatch?.[1]
      ? normalizeVerseColor(colorMatch[1])
      : bareHex
        ? normalizeVerseColor(bareHex)
        : null,
  };
}

/** USFM → book / chapter / verse (ex. JHN.3.16). */
export function parseUsfmVerseRef(usfm: string): {
  bookId: string;
  chapterId: string;
  verse: number;
} | null {
  const raw = String(usfm || "")
    .trim()
    .toUpperCase()
    .replace(/^MARK-/, "")
    .replace(/^VERSE-/, "");
  const match = raw.match(/^([A-Z0-9]{2,3})\.(\d+)\.(\d+)/);
  if (!match) return null;
  const verse = Number(match[3]);
  if (!Number.isFinite(verse) || verse < 1) return null;
  return { bookId: match[1]!, chapterId: match[2]!, verse };
}

/**
 * Applique les VerseMark du catalogue Notion sur le store local (multi-appareil).
 * Ne retire pas les marques locales absentes du remote (merge additif).
 */
export function applyVerseMarksFromCards(cards: readonly Flashcard[]): boolean {
  const marks = cards.filter(isVerseMarkCard);
  if (!marks.length) return false;
  const store = readStore();
  let changed = false;
  for (const card of marks) {
    const meta = parseVerseMarkMeta(card.verso);
    const usfm =
      meta.usfm ||
      (String(card.id || "").startsWith("mark-")
        ? String(card.id).slice(5).toUpperCase()
        : null);
    if (!usfm) continue;
    const ref = parseUsfmVerseRef(usfm);
    if (!ref) continue;
    const color = normalizeVerseColor(meta.color || card.color || "#2563eb");
    const key = chapterKey(ref.bookId, ref.chapterId);
    const chapter = { ...(store[key] ?? {}) };
    const verseKey = String(ref.verse);
    if (chapter[verseKey] === color) continue;
    chapter[verseKey] = color;
    store[key] = chapter;
    changed = true;
  }
  if (changed) writeStore(store);
  return changed;
}
