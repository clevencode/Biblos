import { PASSAGE_LOADING_COPY } from "../bible/viewState/loadingConstants";
import {
  passageChapterLoadingLead,
  type PassagePresentation,
} from "../bible/viewState/selectors";
import { skeletonVerseSlotIds, type PassageSkeletonSchema } from "../bible/viewState/types";

type BibleChapterLoadingPlaceholderProps = {
  bookTitle: string;
  chapterId: string;
  presentation?: Pick<PassagePresentation, "isReloading">;
  lineCount?: number;
  schema?: PassageSkeletonSchema;
};

const SKELETON_LINES_DEFAULT = 9;

export function BibleChapterLoadingPlaceholder({
  bookTitle,
  chapterId,
  presentation,
  lineCount = SKELETON_LINES_DEFAULT,
  schema,
}: BibleChapterLoadingPlaceholderProps) {
  const reload = presentation?.isReloading ?? false;
  const lead = presentation
    ? passageChapterLoadingLead(presentation)
    : PASSAGE_LOADING_COPY.openingChapter;

  const slotIds = schema ? skeletonVerseSlotIds(schema) : null;
  const lineTotal = Math.max(1, Math.min(lineCount, slotIds?.length ?? lineCount));

  return (
    <div
      className={`bible-chapter-loading${reload ? " is-reload" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`${lead} ${bookTitle} ${chapterId}`}
    >
      <p className="bible-chapter-loading-lead sr-only">{lead}</p>
      <div className="bible-chapter-loading-verses" aria-hidden="true">
        {Array.from({ length: lineTotal }, (_, i) => {
          const verseNum = i + 1;
          const rowKey = slotIds?.[i] ?? `skeleton-line-${verseNum}`;
          return (
            <div
              key={rowKey}
              className={`bible-chapter-loading-verse${i % 4 === 3 ? " is-gap" : ""}`}
            >
              <span className="bible-chapter-loading-num is-opaque">{verseNum}</span>
              <span
                className={[
                  "bible-chapter-loading-line",
                  i % 3 === 1 ? "is-medium" : "",
                  i % 3 === 2 ? "is-short" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
