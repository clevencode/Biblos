/**
 * NavigationDataAdapter — Biblos (fetchPassage + cache de janela existente).
 */

import type {
  BookManifest,
  NavigationDataAdapter,
  VerseNode,
} from "../contracts/navigation.contract";
import {
  bookCodeToId,
  bookIdToCode,
  encodeUsfmId,
} from "../core/usfm.codec";
import type { BibleTextVersionId } from "../../bibleVersions";
import { fetchPassageForVersion } from "../../passageForVersion";
import { chapterUsfm } from "../../../youversion/client";
import type { YouVersionBook } from "../../../youversion/client";
import { CANON_BOOKS } from "../../../youversion/canon";

export function createBiblosPassageAdapter(
  resolveVersion: () => BibleTextVersionId | string = () => "s21",
): NavigationDataAdapter {
  return {
    async fetchChapter(version, bookId, chapter) {
      const code = bookIdToCode(bookId);
      if (!code) return [];
      const usfm = chapterUsfm(code, String(chapter));
      const ver = (version || resolveVersion()) as BibleTextVersionId;
      const result = await fetchPassageForVersion(ver, usfm);
      if (!result.ok || !result.passage?.verses?.length) {
        return [];
      }
      const nodes: VerseNode[] = [];
      for (const v of result.passage.verses) {
        const num = Number(v.number);
        if (!Number.isFinite(num) || num < 1) continue;
        nodes.push({
          usfmId: encodeUsfmId(bookId, chapter, num),
          bookId,
          chapter,
          verse: num,
          text: String(v.text || ""),
        });
      }
      return nodes;
    },
  };
}

/** Constrói manifesto a partir do catálogo YouVersion / S21. */
export function buildBiblosManifest(
  books: YouVersionBook[],
): BookManifest[] {
  const out: BookManifest[] = [];
  for (const book of books) {
    const code = String(book.id || "").toUpperCase();
    const bookId = bookCodeToId(code);
    if (bookId == null) continue;
    const chapters = book.chapters ?? [];
    const versesPerChapter =
      chapters.length > 0
        ? chapters.map(() => 30)
        : guessVerseCounts(code);
    out.push({
      bookId,
      code,
      name: book.title || book.fullTitle || code,
      direction: "ltr",
      versesPerChapter,
    });
  }
  if (out.length > 0) return out;
  return buildCanonFallbackManifest();
}

function guessVerseCounts(code: string): number[] {
  // Fallback leve — 1 cap com 30 versículos se o catálogo não tiver chapters.
  void code;
  return [30];
}

export function buildCanonFallbackManifest(): BookManifest[] {
  return CANON_BOOKS.map((book, i) => ({
    bookId: i + 1,
    code: book.id,
    name: book.title,
    direction: "ltr" as const,
    versesPerChapter: defaultChapterLens(book.id),
  }));
}

/** Contagens aproximadas protestant — só fallback offline. */
function defaultChapterLens(code: string): number[] {
  const known: Record<string, number> = {
    PSA: 150,
    GEN: 50,
    MAT: 28,
    JHN: 21,
    REV: 22,
  };
  const n = known[code] ?? 20;
  return Array.from({ length: n }, () => 30);
}
