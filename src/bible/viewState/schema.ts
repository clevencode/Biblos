import { chapterUsfm } from "../../youversion/client";
import {
  PASSAGE_DEFAULT_VERSE_COUNT,
  PASSAGE_GRID_VERSE_SLOTS,
  PASSAGE_SKELETON_VERSE_LINES,
  type PassageSkeletonSchema,
} from "./types";

export function buildPassageSkeletonSchema(input: {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  verseCount?: number | null;
  contentCharLength?: number | null;
}): PassageSkeletonSchema {
  const bookId = input.bookId.toUpperCase();
  const chapterId = String(input.chapterId || "1");
  const usfm = chapterUsfm(bookId, chapterId).toUpperCase();
  const verseCount = Math.max(
    1,
    Number.isFinite(input.verseCount) && input.verseCount! > 0
      ? Math.floor(input.verseCount!)
      : PASSAGE_DEFAULT_VERSE_COUNT,
  );
  const skeletonVerseSlots = Math.min(PASSAGE_SKELETON_VERSE_LINES, verseCount);
  const gridVerseSlots = Math.min(PASSAGE_GRID_VERSE_SLOTS, Math.max(verseCount, 24));
  const contentCharLength =
    Number.isFinite(input.contentCharLength) && input.contentCharLength! > 0
      ? Math.floor(input.contentCharLength!)
      : verseCount * 72;

  return {
    usfm,
    bookId,
    bookTitle: input.bookTitle,
    chapterId,
    verseCount,
    skeletonVerseSlots,
    gridVerseSlots,
    contentCharLength,
  };
}

export function schemasSamePassage(a: PassageSkeletonSchema, b: PassageSkeletonSchema): boolean {
  return a.usfm.toUpperCase() === b.usfm.toUpperCase();
}
