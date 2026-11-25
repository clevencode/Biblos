import type { YouVersionBook } from "../../youversion/client";

/** Referência estável para livros sem capítulos (evita `[]` novo por render). */
export const EMPTY_CHAPTER_IDS: readonly string[] = Object.freeze([]);

/**
 * Mapa bookId → ids de capítulo (uppercase).
 * Construir uma vez por catálogo; lookups O(1) sem realloc por linha.
 */
export function buildChapterIdsByBook(
  books: YouVersionBook[],
): Readonly<Record<string, readonly string[]>> {
  const out: Record<string, readonly string[]> = Object.create(null);
  for (const book of books) {
    const id = String(book.id || "").toUpperCase();
    if (!id) continue;
    const chapters = book.chapters;
    out[id] =
      chapters?.length > 0
        ? chapters.map((c) => c.id)
        : EMPTY_CHAPTER_IDS;
  }
  return out;
}

export function chapterIdsForBook(
  map: Readonly<Record<string, readonly string[]>>,
  bookId: string,
): readonly string[] {
  return map[String(bookId || "").toUpperCase()] ?? EMPTY_CHAPTER_IDS;
}
