import { YvIcon } from "./YvIcon";

type BiblePassageChipProps = {
  variant: "book" | "chapter";
  label: string;
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
  loading = false,
  open = false,
  disabled = false,
  ariaLabel,
  title,
  onClick,
}: BiblePassageChipProps) {
  const trimmed = String(label || "").trim();
  const showSkeleton =
    loading || (variant === "book" && !trimmed) || (variant === "chapter" && !trimmed);
  /** Placeholder tabular — largura estável (livre/capítulo) enquanto hidrata. */
  const placeholder = variant === "chapter" ? "88" : "Livre";
  const visibleLabel = showSkeleton ? (trimmed || placeholder) : trimmed;
  const kindIcon = variant === "book" ? "menu_book" : "format_list_numbered";

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
      <YvIcon name={kindIcon} opsz={20} className="bible-yv-passage-chip-kind" />
      <span className="bible-yv-passage-chip-value">{visibleLabel}</span>
      <YvIcon
        name="keyboard_arrow_down"
        opsz={20}
        className="bible-yv-passage-chip-caret"
      />
    </button>
  );
}
