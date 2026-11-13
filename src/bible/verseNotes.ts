/**
 * Notas pessoais por versículo (localStorage).
 * Chave com escopo: versionId:usfm:chapter:verse (+ espelho universal).
 */

import {
  universalVerseKey,
  verseStudyKey,
  type ReadingPassageRef,
} from "./readingScope";
import type { BibleTextVersionId } from "./bibleVersions";

export type VerseNoteRecord = {
  text: string;
  updatedAt: string;
  versionId: BibleTextVersionId;
  usfm: string;
  chapter: number;
  verse: number;
  universalKey: string;
};

const STORE_KEY = "biblos-verse-notes-v1";
const VERSE_NOTES_EVENT = "biblos-verse-notes";

type Store = Record<string, VerseNoteRecord>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(VERSE_NOTES_EVENT));
  }
}

export function loadVerseNote(
  versionId: BibleTextVersionId,
  usfm: string,
  chapter: number | string,
  verse: number | string,
): VerseNoteRecord | null {
  const key = verseStudyKey(versionId, usfm, chapter, verse);
  return readStore()[key] ?? null;
}

export function saveVerseNote(
  ref: Pick<ReadingPassageRef, "versionId" | "usfm" | "chapter"> & {
    verse: number;
  },
  text: string,
): VerseNoteRecord {
  const chapter = Number(ref.chapter);
  const verse = Number(ref.verse);
  const usfm = String(ref.usfm || "").trim().toUpperCase();
  const key = verseStudyKey(ref.versionId, usfm, chapter, verse);
  const record: VerseNoteRecord = {
    text: text.trim(),
    updatedAt: new Date().toISOString(),
    versionId: ref.versionId,
    usfm,
    chapter,
    verse,
    universalKey: universalVerseKey(usfm, chapter, verse),
  };
  const store = readStore();
  if (!record.text) {
    delete store[key];
  } else {
    store[key] = record;
  }
  writeStore(store);
  notify();
  return record;
}

export type VerseNoteStore = Store;

export function exportVerseNoteStore(): VerseNoteStore {
  return readStore();
}

export function importVerseNoteStore(
  incoming: VerseNoteStore,
  merge = true,
): boolean {
  if (!incoming || typeof incoming !== "object") return false;
  const store = merge ? { ...readStore() } : {};
  let changed = false;
  for (const [key, remote] of Object.entries(incoming)) {
    if (!remote || typeof remote !== "object") continue;
    const local = store[key];
    if (
      merge &&
      local?.updatedAt &&
      remote.updatedAt &&
      local.updatedAt >= remote.updatedAt
    ) {
      continue;
    }
    store[key] = {
      text: String(remote.text ?? ""),
      updatedAt:
        typeof remote.updatedAt === "string" && remote.updatedAt
          ? remote.updatedAt
          : new Date().toISOString(),
      versionId: remote.versionId === "ht98" ? "ht98" : "s21",
      usfm: String(remote.usfm || "").toUpperCase(),
      chapter: Number(remote.chapter) || 1,
      verse: Number(remote.verse) || 1,
      universalKey:
        String(remote.universalKey || "") ||
        universalVerseKey(
          String(remote.usfm || ""),
          remote.chapter,
          remote.verse,
        ),
    };
    changed = true;
  }
  if (changed) {
    writeStore(store);
    notify();
  }
  return changed;
}

export function clearVerseNoteStore(): void {
  writeStore({});
  notify();
}

export function subscribeVerseNotes(onChange: () => void): () => void {
  window.addEventListener(VERSE_NOTES_EVENT, onChange);
  return () => window.removeEventListener(VERSE_NOTES_EVENT, onChange);
}
