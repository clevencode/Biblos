import type { PassageLoadErrorKind } from "../passageLoadError";
import type { YouVersionBible, YouVersionPassage } from "../../youversion/client";

export const PASSAGE_DEFAULT_VERSE_COUNT = 24;

export type PassageEmptyReason = "no_selection" | "missing_offline";

/** Metadados de layout da passagem (contagem de versículos, USFM). */
export type PassageLayoutSchema = {
  usfm: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  verseCount: number;
  contentCharLength: number;
};

export type PassageViewState =
  | {
      status: "idle";
      schema: PassageLayoutSchema | null;
    }
  | {
      status: "loading";
      schema: PassageLayoutSchema;
      /** same USFM reload — keep verses visible under overlay */
      reload: boolean;
      stalePassage: YouVersionPassage | null;
    }
  | {
      status: "success";
      schema: PassageLayoutSchema;
      passage: YouVersionPassage;
      bibleId?: number | null;
      bible?: YouVersionBible | null;
    }
  | {
      status: "empty";
      schema: PassageLayoutSchema;
      reason: PassageEmptyReason;
    }
  | {
      status: "error";
      schema: PassageLayoutSchema;
      errorKind: PassageLoadErrorKind;
      message: string;
    };

export function passageSchemaCssVars(schema: PassageLayoutSchema): Record<string, string> {
  return {
    "--passage-verse-count": String(schema.verseCount),
  };
}
