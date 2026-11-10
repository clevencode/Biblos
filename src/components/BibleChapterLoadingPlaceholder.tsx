import { PASSAGE_LOADING_COPY } from "../bible/viewState/loadingConstants";
import {
  passageChapterLoadingLead,
  type PassagePresentation,
} from "../bible/viewState/selectors";
import type { PassageSkeletonSchema } from "../bible/viewState/types";
import { BibleChapterVersesSkeleton } from "../skeleton";

type BibleChapterLoadingPlaceholderProps = {
  bookTitle: string;
  chapterId: string;
  presentation?: Pick<PassagePresentation, "isReloading">;
  lineCount?: number;
  schema?: PassageSkeletonSchema;
};

export function BibleChapterLoadingPlaceholder({
  bookTitle,
  chapterId,
  presentation,
  lineCount,
  schema,
}: BibleChapterLoadingPlaceholderProps) {
  const reload = presentation?.isReloading ?? false;
  const lead = presentation
    ? passageChapterLoadingLead(presentation)
    : PASSAGE_LOADING_COPY.openingChapter;

  return (
    <div
      className={`bible-chapter-loading${reload ? " is-reload" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`${lead} ${bookTitle} ${chapterId}`}
    >
      <p className="bible-chapter-loading-lead sr-only">{lead}</p>
      <BibleChapterVersesSkeleton lineCount={lineCount} schema={schema} />
    </div>
  );
}
