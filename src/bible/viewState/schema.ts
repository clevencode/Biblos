import { chapterUsfm } from "../../youversion/client";
import {
  PASSAGE_DEFAULT_VERSE_COUNT,
  type PassageLayoutSchema,
} from "./types";

export function buildPassageLayoutSchema(input: {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  verseCount?: number | null;
  contentCharLength?: number | null;
}): PassageLayoutSchema {
  const bookId = input.bookId.toUpperCase();
  const chapterId = String(input.chapterId || "1");
  const usfm = chapterUsfm(bookId, chapterId).toUpperCase();
  const verseCount = Math.max(
    1,
    Number.isFinite(input.verseCount) && input.verseCount! > 0
      ? Math.floor(input.verseCount!)
      : PASSAGE_DEFAULT_VERSE_COUNT,
  );
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
    contentCharLength,
  };
}

export function schemasSamePassage(a: PassageLayoutSchema, b: PassageLayoutSchema): boolean {
  return a.usfm.toUpperCase() === b.usfm.toUpperCase();
}
