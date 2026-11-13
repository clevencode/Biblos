import { loadTskeChapter, parseTskeBody, type TskeVerseBlock } from "./tske";

export type VerseStudyBundle = {
  tske: TskeVerseBlock | null;
  /** Capítulo TSKE ausente no bundle (404/HTML) — distinto de «sem refs». */
  unavailable?: boolean;
};

export async function loadVerseStudy(
  bookId: string,
  chapterId: string,
  verse: number,
): Promise<VerseStudyBundle> {
  const chapter = Number(chapterId);
  if (!Number.isFinite(chapter) || !Number.isFinite(verse)) {
    return { tske: null, unavailable: true };
  }
  const chapterData = await loadTskeChapter(bookId, chapter);
  if (!chapterData) {
    return { tske: null, unavailable: true };
  }
  const block = chapterData[String(verse)];
  if (!block) {
    return { tske: null, unavailable: false };
  }
  const tske: TskeVerseBlock = {
    heading: block.heading,
    body: block.body,
    refs: parseTskeBody(block.body ?? "", bookId, chapter),
  };
  return { tske, unavailable: false };
}
