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
  onOpenRef: (usfm: string) => void;
  versionId?: BibleTextVersionId;
  books?: YouVersionBook[];
};

export function BibleStudySheet({
  open,
  bookId,
  chapterId,
  verse,
  onOpenRef,
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
    onOpenRef,
    initialTab: "refs",
  };
  return <VerseStudyPanel {...props} />;
}
