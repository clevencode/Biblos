/**
 * Estado granular de marcas do capítulo activo — evita re-render global do leitor
 * quando só um versículo muda de cor.
 */

import { create } from "zustand";
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

function mapToRecord(map: ReadonlyMap<number, string>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [verse, hex] of map) {
    out[verse] = hex;
  }
  return out;
}

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
    const { bookId, chapterId, hydrateChapter } = useVerseMarksStore.getState();
    if (!bookId || !chapterId) return;
    hydrateChapter(bookId, chapterId);
  });
  return revisionUnsub;
}

if (typeof window !== "undefined") {
  bindVerseMarksStoreToStorage();
}
