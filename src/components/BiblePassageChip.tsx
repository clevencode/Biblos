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
  const showSkeleton = loading || !String(label || "").trim();

  if (showSkeleton) {
    return (
      <span
        className={`bible-yv-passage-chip-skeleton is-${variant}`}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      className={`bible-yv-passage-chip is-${variant}${open ? " is-open" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={ariaLabel}
      title={title}
    >
      <span className="bible-yv-passage-chip-value">{label}</span>
      <YvIcon
        name="keyboard_arrow_down"
        opsz={20}
        className="bible-yv-passage-chip-caret"
      />
    </button>
  );
}
