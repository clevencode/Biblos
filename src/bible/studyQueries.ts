import { fetchTskeForVerse, type TskeVerseBlock } from "./tske";

export type VerseStudyBundle = {
  tske: TskeVerseBlock | null;
};

export async function loadVerseStudy(
  bookId: string,
  chapterId: string,
  verse: number,
): Promise<VerseStudyBundle> {
  const chapter = Number(chapterId);
  if (!Number.isFinite(chapter) || !Number.isFinite(verse)) {
    return { tske: null };
  }
  const tske = await fetchTskeForVerse(bookId, chapter, verse);
  return { tske };
}
