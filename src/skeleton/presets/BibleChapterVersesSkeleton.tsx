import { Skeleton } from "../Skeleton";
import { SkeletonStack } from "../SkeletonStack";
import { skeletonVerseSlotIds, type PassageSkeletonSchema } from "../../bible/viewState/types";

const SKELETON_LINES_DEFAULT = 9;

type BibleChapterVersesSkeletonProps = {
  lineCount?: number;
  schema?: PassageSkeletonSchema;
  className?: string;
};

/** Morfologia do capítulo em abertura — números reais, linhas em shimmer. */
export function BibleChapterVersesSkeleton({
  lineCount = SKELETON_LINES_DEFAULT,
  schema,
  className = "",
}: BibleChapterVersesSkeletonProps) {
  const slotIds = schema ? skeletonVerseSlotIds(schema) : null;
  const lineTotal = Math.max(1, Math.min(lineCount, slotIds?.length ?? lineCount));

  return (
    <SkeletonStack
      gap="sm"
      className={`bible-chapter-loading-verses${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      {Array.from({ length: lineTotal }, (_, i) => {
        const verseNum = i + 1;
        const rowKey = slotIds?.[i] ?? `skeleton-line-${verseNum}`;
        const width =
          i % 3 === 2 ? "62%" : i % 3 === 1 ? "88%" : "100%";
        return (
          <div
            key={rowKey}
            className={`bible-chapter-loading-verse${i % 4 === 3 ? " is-gap" : ""}`}
          >
            <span className="bible-chapter-loading-num is-opaque">{verseNum}</span>
            <Skeleton block height="0.82rem" width={width} className="bible-chapter-loading-line" />
          </div>
        );
      })}
    </SkeletonStack>
  );
}
