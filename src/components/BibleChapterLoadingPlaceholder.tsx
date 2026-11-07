import { skeletonVerseSlotIds, type PassageSkeletonSchema } from "../bible/viewState/types";

type BibleChapterLoadingPlaceholderProps = {
  bookTitle: string;
  chapterId: string;
  /** Rechargement du même chapitre (texte encore en mémoire côté état). */
  reload?: boolean;
  lineCount?: number;
  schema?: PassageSkeletonSchema;
};

const SKELETON_LINES_DEFAULT = 9;

export function BibleChapterLoadingPlaceholder({
  bookTitle,
  chapterId,
  reload = false,
  lineCount = SKELETON_LINES_DEFAULT,
  schema,
}: BibleChapterLoadingPlaceholderProps) {
  const lead = reload
    ? "Mise à jour du chapitre…"
    : "Ouverture du chapitre…";

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
      <p className="bible-chapter-loading-lead">{lead}</p>
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
