import { chapterUsfm } from "../../youversion/client";
import type { PassageSkeletonSchema } from "./types";

/** Numéros pour l’étape verset du picker — schema de destination, pas le chapitre en stale. */
export function pickerVerseNumberOptions(input: {
  bookId: string;
  chapterId: string;
  schema: PassageSkeletonSchema | null;
  passageVerseNumbers: number[] | undefined;
  /** USFM du texte chargé (évite stale du chapitre précédent à l'ouverture). */
  passageUsfm?: string | null;
}): number[] {
  const targetUsfm = chapterUsfm(input.bookId, input.chapterId).toUpperCase();
  const passage = input.passageVerseNumbers;
  const loadedUsfm = input.passageUsfm?.toUpperCase() ?? null;

  if (passage?.length && loadedUsfm === targetUsfm) {
    return passage;
  }

  if (input.schema && input.schema.usfm.toUpperCase() === targetUsfm) {
    const n = input.schema.verseCount;
    if (n > 0) {
      return Array.from({ length: n }, (_, i) => i + 1);
    }
  }

  return passage ?? [];
}
