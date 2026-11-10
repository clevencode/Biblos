import type { Flashcard } from "./types";

function isVerseMarkCard(card: Pick<Flashcard, "id" | "cardCategory">): boolean {
  const cat = String(card.cardCategory || "").toUpperCase();
  if (cat === "VERSEMARK") return true;
  return String(card.id || "").toUpperCase().startsWith("MARK-");
}
import { normalizeVerseColor, parseVerseHex } from "./verseColors";

const STORAGE_KEY = "biblos.verseMarks";
const TOUCHED_KEY = "biblos.verseMarks.touched";
const REMOVED_KEY = "biblos.verseMarks.removed";
const REVISION_EVENT = "biblos-verse-marks-revision";

type TouchedStore = Record<string, string>;

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

function readTouched(): TouchedStore {
  try {
    const raw = localStorage.getItem(TOUCHED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TouchedStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTouched(store: TouchedStore) {
  try {
    localStorage.setItem(TOUCHED_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function readRemoved(): TouchedStore {
  try {
    const raw = localStorage.getItem(REMOVED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TouchedStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRemoved(store: TouchedStore) {
  try {
    localStorage.setItem(REMOVED_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function exportVerseMarkRemoved(): TouchedStore {
  return readRemoved();
}

function verseTouchKey(bookId: string, chapterId: string, verse: number): string {
  return `${chapterKey(bookId, chapterId)}:${verse}`;
}

function touchVerses(
  bookId: string,
  chapterId: string,
  verses: readonly number[],
  at = new Date().toISOString(),
) {
  const touched = readTouched();
  let changed = false;
  for (const verse of verses) {
    if (!Number.isFinite(verse) || verse < 1) continue;
    const key = verseTouchKey(bookId, chapterId, verse);
    if (touched[key] !== at) {
      touched[key] = at;
      changed = true;
    }
  }
  if (changed) writeTouched(touched);
}

function notifyRevision() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REVISION_EVENT));
  }
}

function writeStore(store: VerseMarkStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    notifyRevision();
  } catch {
    /* quota / private mode */
  }
}

export function exportVerseMarkStore(): VerseMarkStore {
  return readStore();
}

export function exportVerseMarkTouched(): TouchedStore {
  return readTouched();
}

/** Fusion multi-appareil (couleur = plus récent `touchedAt`). */
export function importVerseMarkStore(
  incoming: VerseMarkStore,
  touchedIncoming: TouchedStore = {},
  removedIncoming: TouchedStore = {},
  merge = true,
): boolean {
  if (!incoming || typeof incoming !== "object") return false;
  const store = merge ? { ...readStore() } : {};
  const touched = merge ? { ...readTouched() } : {};
  const removed = merge ? { ...readRemoved() } : {};
  let changed = false;

  for (const [touchKey, remoteRemovedAt] of Object.entries(removedIncoming)) {
    if (!remoteRemovedAt) continue;
    const localRemovedAt = removed[touchKey] || "";
    const localTouch = touched[touchKey] || "";
    if (merge && localRemovedAt >= remoteRemovedAt) continue;
    if (merge && localTouch > remoteRemovedAt) continue;
    const dot = touchKey.lastIndexOf(":");
    if (dot < 1) continue;
    const chapter = touchKey.slice(0, dot);
    const verseRaw = touchKey.slice(dot + 1);
    const chapterStore = { ...(store[chapter] ?? {}) };
    if (chapterStore[verseRaw]) {
      delete chapterStore[verseRaw];
      changed = true;
    }
    if (Object.keys(chapterStore).length) store[chapter] = chapterStore;
    else delete store[chapter];
    removed[touchKey] = remoteRemovedAt;
    delete touched[touchKey];
  }

  for (const [chapter, verses] of Object.entries(incoming)) {
    if (!verses || typeof verses !== "object") continue;
    const chapterStore = { ...(store[chapter] ?? {}) };
    for (const [verseRaw, hex] of Object.entries(verses)) {
      const verse = Number(verseRaw);
      if (!Number.isFinite(verse) || verse < 1) continue;
      const touchKey = `${chapter}:${verse}`;
      const remoteRemovedAt = removedIncoming[touchKey] || removed[touchKey] || "";
      const remoteAt = touchedIncoming[touchKey] || "";
      const localAt = touched[touchKey] || "";
      if (remoteRemovedAt && (!localAt || remoteRemovedAt >= localAt)) continue;
      if (merge && localAt && remoteAt && localAt > remoteAt) continue;
      const color = normalizeVerseColor(hex);
      if (chapterStore[verseRaw] === color && touched[touchKey] === (remoteAt || touched[touchKey])) {
        continue;
      }
      chapterStore[verseRaw] = color;
      if (remoteAt) touched[touchKey] = remoteAt;
      delete removed[touchKey];
      changed = true;
    }
    if (Object.keys(chapterStore).length) store[chapter] = chapterStore;
    else delete store[chapter];
  }

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    writeTouched(touched);
    writeRemoved(removed);
    notifyRevision();
  }
  return changed;
}

export function subscribeVerseMarksRevision(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(REVISION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(REVISION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
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
  const now = new Date().toISOString();
  if (hex) {
    touchVerses(bookId, chapterId, verses, now);
    const removed = readRemoved();
    let removedChanged = false;
    for (const verse of verses) {
      const key = verseTouchKey(bookId, chapterId, verse);
      if (removed[key]) {
        delete removed[key];
        removedChanged = true;
      }
    }
    if (removedChanged) writeRemoved(removed);
  } else {
    const removed = readRemoved();
    const touched = readTouched();
    for (const verse of verses) {
      const key = verseTouchKey(bookId, chapterId, verse);
      removed[key] = now;
      delete touched[key];
    }
    writeRemoved(removed);
    writeTouched(touched);
  }
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
