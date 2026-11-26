/**
 * Estado granular de marcas do capítulo activo — evita re-render global do leitor
 * quando só um versículo muda de cor.
 */

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  loadChapterMarks,
  setVerseMarks,
  subscribeVerseMarksRevision,
} from "../verseMarks";

type VerseMarksState = {
  bookId: string;
  chapterId: string;
  byVerse: Record<number, string>;
  revision: number;
  hydrateChapter: (bookId: string, chapterId: string) => void;
  applyMarks: (
    bookId: string,
    chapterId: string,
    verses: readonly number[],
    color: string | null,
  ) => void;
};

/** Slice n-1 / n / n+1 para runs de marca — 1 subcrição, igualdade shallow. */
export type VerseMarkNeighbors = {
  raw: string | undefined;
  prev: string | undefined;
  next: string | undefined;
};

export function useVerseMarkNeighbors(verseNumber: number): VerseMarkNeighbors {
  return useVerseMarksStore(
    useShallow((s) => ({
      raw: s.byVerse[verseNumber],
      prev: s.byVerse[verseNumber - 1],
      next: s.byVerse[verseNumber + 1],
    })),
  );
}

function mapToRecord(map: ReadonlyMap<number, string>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [verse, hex] of map) {
    out[verse] = hex;
  }
  return out;
}

/**
 * Write local (`applyMarks`) já actualiza `byVerse` — a revision emitida por
 * `setVerseMarks` não deve rehidratar o mesmo capítulo (evita double-set).
 * Sync/import remoto continuam a passar (flag a false).
 */
let skipNextRevisionHydrate = false;

export const useVerseMarksStore = create<VerseMarksState>((set, get) => ({
  bookId: "",
  chapterId: "",
  byVerse: {},
  revision: 0,
  hydrateChapter: (bookId, chapterId) => {
    const map = loadChapterMarks(bookId, chapterId);
    set({
      bookId,
      chapterId,
      byVerse: mapToRecord(map),
      revision: get().revision + 1,
    });
  },
  applyMarks: (bookId, chapterId, verses, color) => {
    skipNextRevisionHydrate = true;
    const map = setVerseMarks(bookId, chapterId, verses, color);
    const cur = get();
    if (cur.bookId === bookId && cur.chapterId === chapterId) {
      set({
        byVerse: mapToRecord(map),
        revision: cur.revision + 1,
      });
    }
  },
}));

/** Cor bruta do versículo no capítulo hidratado (selector atómico). */
export function selectVerseMark(
  state: VerseMarksState,
  verse: number,
): string | undefined {
  return state.byVerse[verse];
}

let revisionUnsub: (() => void) | null = null;

/** Rehidrata o capítulo activo após sync/import remoto. */
export function bindVerseMarksStoreToStorage(): () => void {
  if (revisionUnsub) return revisionUnsub;
  revisionUnsub = subscribeVerseMarksRevision(() => {
    if (skipNextRevisionHydrate) {
      skipNextRevisionHydrate = false;
      return;
    }
    const { bookId, chapterId, hydrateChapter } = useVerseMarksStore.getState();
    if (!bookId || !chapterId) return;
    hydrateChapter(bookId, chapterId);
  });
  return revisionUnsub;
}

if (typeof window !== "undefined") {
  bindVerseMarksStoreToStorage();
}
