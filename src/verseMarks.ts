import { normalizeVerseColor } from "./verseColors";
import {
  persistLocalString,
  removePersistedString,
} from "./services/storage/StorageAdapter";

const STORAGE_KEY = "biblos.verseMarks";
/** `LIVRO.cap:versículo` → data em que foi marcado (ordenação da lista). */
const MARKED_AT_KEY = "biblos.verseMarks.touched";
/** Remoções do formato antigo — só lidas para migrar para o user-sync. */
const LEGACY_REMOVED_KEY = "biblos.verseMarks.removed";
const REVISION_EVENT = "biblos-verse-marks-revision";

type TimeMap = Record<string, string>;

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

function readTimes(key: string): TimeMap {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TimeMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readMarkedAt(): TimeMap {
  return readTimes(MARKED_AT_KEY);
}

function writeMarkedAt(times: TimeMap) {
  persistLocalString(MARKED_AT_KEY, JSON.stringify(times));
}

function verseKey(bookId: string, chapterId: string, verse: number): string {
  return `${chapterKey(bookId, chapterId)}:${verse}`;
}

/** Migração: remoções do formato antigo (`LIVRO.cap:versículo` → data). */
export function readLegacyVerseMarkRemovals(): TimeMap {
  return readTimes(LEGACY_REMOVED_KEY);
}

export function dropLegacyVerseMarkRemovals(): void {
  removePersistedString(LEGACY_REMOVED_KEY);
}

function notifyRevision() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REVISION_EVENT));
  }
}

function writeStore(store: VerseMarkStore) {
  persistLocalString(STORAGE_KEY, JSON.stringify(store));
  notifyRevision();
}

/** Uma marca para o user-sync: cor + data em que foi marcada. */
export type VerseMarkEntry = { color: string; markedAt: string };

/** Marcas por `LIVRO.cap:versículo` (formato canónico do user-sync). */
export function exportVerseMarkEntries(): Record<string, VerseMarkEntry> {
  const store = readStore();
  const markedAt = readMarkedAt();
  const out: Record<string, VerseMarkEntry> = {};
  for (const [chapter, verses] of Object.entries(store)) {
    for (const [verse, hex] of Object.entries(verses ?? {})) {
      const n = Number(verse);
      if (!Number.isFinite(n) || n < 1) continue;
      const key = `${chapter}:${n}`;
      out[key] = {
        color: normalizeVerseColor(hex),
        markedAt: markedAt[key] || "",
      };
    }
  }
  return out;
}

/** Substitui todas as marcas (fusão feita pelo user-sync). */
export function replaceVerseMarkEntries(
  entries: Record<string, VerseMarkEntry>,
): void {
  const store: VerseMarkStore = {};
  const markedAt: TimeMap = {};
  for (const [key, entry] of Object.entries(entries ?? {})) {
    const dot = key.lastIndexOf(":");
    if (dot < 1 || !entry || typeof entry.color !== "string") continue;
    const chapter = key.slice(0, dot);
    const verse = Number(key.slice(dot + 1));
    if (!Number.isFinite(verse) || verse < 1) continue;
    (store[chapter] ??= {})[String(verse)] = normalizeVerseColor(entry.color);
    if (entry.markedAt) markedAt[`${chapter}:${verse}`] = entry.markedAt;
  }
  writeMarkedAt(markedAt);
  writeStore(store);
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

/** Efface marques locales (logout / delete) — pas les Bibles IndexedDB. */
export function clearVerseMarkStore(): void {
  removePersistedString(STORAGE_KEY);
  removePersistedString(MARKED_AT_KEY);
  dropLegacyVerseMarkRemovals();
  notifyRevision();
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
  const markedAt = readMarkedAt();
  const now = new Date().toISOString();
  for (const verse of verses) {
    if (!Number.isFinite(verse) || verse < 1) continue;
    const id = verseKey(bookId, chapterId, verse);
    if (hex) markedAt[id] = now;
    else delete markedAt[id];
  }
  writeMarkedAt(markedAt);
  /* UI já actualizada; o user-sync data a mudança e envia em background. */
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

/** Nombre de versets uniques surlignés (cote soft-auth). */
export const FREE_MARK_QUOTA = 10;

export function countMarkedVerses(): number {
  return listAllVerseMarks().length;
}

export function isOverFreeMarkQuota(quota = FREE_MARK_QUOTA): boolean {
  return countMarkedVerses() >= quota;
}

/** Tous les versets marqués (local) — plus récent (`touched`) en premier. */
export function listAllVerseMarks(): SavedVerseMark[] {
  const store = readStore();
  const touched = readMarkedAt();
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
    const ta =
      Date.parse(
        touched[verseKey(a.bookId, a.chapterId, a.verse)] || "",
      ) || 0;
    const tb =
      Date.parse(
        touched[verseKey(b.bookId, b.chapterId, b.verse)] || "",
      ) || 0;
    if (tb !== ta) return tb - ta;
    /* Tie-break canónico se o mesmo instante / sem touched. */
    const byBook = a.bookId.localeCompare(b.bookId, "fr");
    if (byBook !== 0) return byBook;
    const byChapter = Number(a.chapterId) - Number(b.chapterId);
    if (byChapter !== 0) return byChapter;
    return a.verse - b.verse;
  });
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
