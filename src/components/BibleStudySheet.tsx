/**
 * Compat: a folha de estudo passa a ser o VerseStudyDrawer com abas.
 * Mantém a API mínima antiga para chamadas legadas.
 */

import {
  VerseStudyDrawer,
  type VerseStudyDrawerProps,
} from "./VerseStudyDrawer";
import type { BibleTextVersionId } from "../bible/bibleVersions";

export type BibleStudySheetProps = {
  open: boolean;
  onClose: () => void;
  bookId: string;
  chapterId: string;
  verse: number;
  refLabel: string;
  onOpenRef: (usfm: string) => void;
  versionId?: BibleTextVersionId;
};

export function BibleStudySheet({
  open,
  onClose,
  bookId,
  chapterId,
  verse,
  refLabel,
  onOpenRef,
  versionId = "s21",
}: BibleStudySheetProps) {
  const props: VerseStudyDrawerProps = {
    open,
    onClose,
    versionId,
    bookId,
    chapterId,
    verse,
    refLabel,
    onOpenRef,
    initialTab: "refs",
  };
  return <VerseStudyDrawer {...props} />;
}
