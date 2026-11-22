/** Memória de scroll das grelhas do passage picker (refs — sem setState no gesto). */

export type PickGridScrollKind = "book" | "chapter" | "verse";

export type PickGridScrollMemory = {
  listScrollTop: number;
  /** Utilizador já fez scroll na lista de livros nesta sessão. */
  listScrollTouched: boolean;
  chapterScrollByBook: Record<string, number>;
  verseGridScrollByChapter: Record<string, number>;
};

export const EMPTY_PICK_GRID_SCROLL: PickGridScrollMemory = {
  listScrollTop: 0,
  listScrollTouched: false,
  chapterScrollByBook: {},
  verseGridScrollByChapter: {},
};

export function pickGridScrollKey(
  kind: PickGridScrollKind,
  bookId: string,
  chapterId?: string,
): string {
  const book = String(bookId || "").toUpperCase();
  if (kind === "book") return "book";
  if (kind === "chapter") return `chapter:${book}`;
  return `verse:${book}:${String(chapterId || "").trim()}`;
}

export function readPickGridScroll(
  memory: PickGridScrollMemory,
  kind: PickGridScrollKind,
  bookId: string,
  chapterId?: string,
): number | undefined {
  if (kind === "book") return memory.listScrollTop;
  const book = String(bookId || "").toUpperCase();
  if (!book) return undefined;
  if (kind === "chapter") {
    const saved = memory.chapterScrollByBook[book];
    return typeof saved === "number" ? saved : undefined;
  }
  const chapter = String(chapterId || "").trim();
  if (!chapter) return undefined;
  const saved = memory.verseGridScrollByChapter[`${book}:${chapter}`];
  return typeof saved === "number" ? saved : undefined;
}

export function writePickGridScroll(
  memory: PickGridScrollMemory,
  kind: PickGridScrollKind,
  bookId: string,
  chapterId: string | undefined,
  scrollTop: number,
): void {
  if (kind === "book") {
    memory.listScrollTop = scrollTop;
    memory.listScrollTouched = true;
    return;
  }
  const book = String(bookId || "").toUpperCase();
  if (!book) return;
  if (kind === "chapter") {
    memory.chapterScrollByBook[book] = scrollTop;
    return;
  }
  const chapter = String(chapterId || "").trim();
  if (!chapter) return;
  memory.verseGridScrollByChapter[`${book}:${chapter}`] = scrollTop;
}
