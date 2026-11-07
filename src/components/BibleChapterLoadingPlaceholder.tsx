type BibleChapterLoadingPlaceholderProps = {
  bookTitle: string;
  chapterId: string;
  /** Rechargement du même chapitre (texte encore en mémoire côté état). */
  reload?: boolean;
};

const SKELETON_LINES = 9;

export function BibleChapterLoadingPlaceholder({
  bookTitle,
  chapterId,
  reload = false,
}: BibleChapterLoadingPlaceholderProps) {
  const lead = reload
    ? "Mise à jour du chapitre…"
    : "Ouverture du chapitre…";

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
        {Array.from({ length: SKELETON_LINES }, (_, i) => (
          <div
            key={i}
            className={`bible-chapter-loading-verse${i % 4 === 3 ? " is-gap" : ""}`}
          >
            <span className="bible-chapter-loading-num is-opaque">{i + 1}</span>
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
        ))}
      </div>
    </div>
  );
}
