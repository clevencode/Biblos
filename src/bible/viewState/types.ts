import type { PassageLoadErrorKind } from "../passageLoadError";
import type { YouVersionBible, YouVersionPassage } from "../../youversion/client";

export const PASSAGE_SKELETON_VERSE_LINES = 9;
export const PASSAGE_DEFAULT_VERSE_COUNT = 24;
export const PASSAGE_GRID_VERSE_SLOTS = 50;

export type PassageEmptyReason = "no_selection" | "missing_offline";

export type PassageSkeletonSchema = {
  usfm: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  verseCount: number;
  skeletonVerseSlots: number;
  gridVerseSlots: number;
  contentCharLength: number;
};

export type PassageViewState =
  | {
      status: "idle";
      schema: PassageSkeletonSchema | null;
    }
  | {
      status: "loading";
      schema: PassageSkeletonSchema;
      /** same USFM reload — keep verses visible under overlay */
      reload: boolean;
      stalePassage: YouVersionPassage | null;
    }
  | {
      status: "success";
      schema: PassageSkeletonSchema;
      passage: YouVersionPassage;
      bibleId?: number | null;
      bible?: YouVersionBible | null;
    }
  | {
      status: "empty";
      schema: PassageSkeletonSchema;
      reason: PassageEmptyReason;
    }
  | {
      status: "error";
      schema: PassageSkeletonSchema;
      errorKind: PassageLoadErrorKind;
      message: string;
    };

export function skeletonVerseSlotIds(schema: PassageSkeletonSchema): string[] {
  const n = Math.min(schema.skeletonVerseSlots, schema.verseCount);
  return Array.from({ length: n }, (_, i) => `skeleton:${schema.usfm}:v${i + 1}`);
}

export function gridVerseSlotIds(schema: PassageSkeletonSchema): string[] {
  const n = Math.min(schema.gridVerseSlots, schema.verseCount);
  return Array.from({ length: n }, (_, i) => `grid:${schema.usfm}:v${i + 1}`);
}

export function passageSchemaCssVars(schema: PassageSkeletonSchema): Record<string, string> {
  return {
    "--passage-verse-count": String(schema.verseCount),
    "--passage-skeleton-min-h": `calc(var(--bible-top-chrome, 59px) + ${schema.skeletonVerseSlots} * 2.1rem + 4rem)`,
  };
}
