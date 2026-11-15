/**
 * Compat: estudo unificado no sheet de seleção (VerseStudyPanel).
 */

import {
  VerseStudyPanel,
  type VerseStudyPanelProps,
} from "./VerseStudyDrawer";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import type { YouVersionBook } from "../youversion/client";

export type BibleStudySheetProps = {
  open: boolean;
  onClose: () => void;
  bookId: string;
  chapterId: string;
  verse: number;
  refLabel: string;
  versionId?: BibleTextVersionId;
  books?: YouVersionBook[];
};

export function BibleStudySheet({
  open,
  bookId,
  chapterId,
  verse,
  versionId = "s21",
  books = [],
}: BibleStudySheetProps) {
  if (!open) return null;
  const props: VerseStudyPanelProps = {
    versionId,
    bookId,
    chapterId,
    verse,
    books,
  };
  return <VerseStudyPanel {...props} />;
}
