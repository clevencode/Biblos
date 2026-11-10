import { YvIcon } from "./YvIcon";

type BiblePassageChipProps = {
  variant: "book" | "chapter" | "ref";
  label: string;
  /** Passo `ref`: número do capítulo (tipografia tabular). */
  chapterLabel?: string;
  loading?: boolean;
  open?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
  onClick: () => void;
};

export function BiblePassageChip({
  variant,
  label,
  chapterLabel,
  loading = false,
  open = false,
  disabled = false,
  ariaLabel,
  title,
  onClick,
}: BiblePassageChipProps) {
  const trimmed = String(label || "").trim();
  const chapterTrimmed = String(chapterLabel || "").trim();
  const showSkeleton =
    loading ||
    (variant === "book" && !trimmed) ||
    (variant === "chapter" && !trimmed) ||
    (variant === "ref" && (!trimmed || !chapterTrimmed));
  /** Placeholder tabular — largura estável (livre/capítulo) enquanto hidrata. */
  const placeholder = variant === "chapter" ? "88" : variant === "ref" ? "Livre 88" : "Livre";
  const visibleLabel = showSkeleton ? (trimmed || placeholder) : trimmed;

  return (
    <button
      type="button"
      className={`bible-yv-passage-chip is-${variant}${open ? " is-open" : ""}${
        showSkeleton ? " is-hydrating" : ""
      }`}
      onClick={onClick}
      disabled={disabled || showSkeleton}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-busy={showSkeleton || undefined}
      aria-label={ariaLabel}
      title={showSkeleton ? undefined : title}
    >
      {variant === "ref" ? (
        <span className="bible-yv-passage-chip-value bible-yv-passage-chip-ref">
          <span className="bible-yv-passage-chip-ref-book">
            {showSkeleton ? trimmed || "Livre" : trimmed}
          </span>
          <span className="bible-yv-passage-chip-ref-chapter" aria-hidden={showSkeleton}>
            {showSkeleton ? chapterTrimmed || "88" : chapterTrimmed}
          </span>
        </span>
      ) : (
        <span className="bible-yv-passage-chip-value">{visibleLabel}</span>
      )}
      <YvIcon
        name="keyboard_arrow_down"
        opsz={20}
        className="bible-yv-passage-chip-caret"
      />
    </button>
  );
}
