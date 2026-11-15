import { HeaderTriggerButton } from "./HeaderTriggerButton";

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
  /** `aria-controls` do painel roll (dropdown). */
  panelId?: string;
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
  panelId,
  onClick,
}: BiblePassageChipProps) {
  const trimmed = String(label || "").trim();
  const chapterTrimmed = String(chapterLabel || "").trim();
  const isHydrating =
    loading ||
    (variant === "book" && !trimmed) ||
    (variant === "chapter" && !trimmed) ||
    (variant === "ref" && (!trimmed || !chapterTrimmed));
  /** Placeholder tabular — largura estável (livre/capítulo) enquanto hidrata. */
  const placeholder = variant === "chapter" ? "88" : variant === "ref" ? "Livre 88" : "Livre";
  const visibleLabel = isHydrating ? (trimmed || placeholder) : trimmed;

  const idleLabel =
    variant === "ref" ? (
      <span className="bible-yv-passage-chip-value bible-yv-passage-chip-ref">
        <span className="bible-yv-passage-chip-ref-book">
          {isHydrating ? trimmed || "Livre" : trimmed}
        </span>
        <span
          className="bible-yv-passage-chip-ref-chapter"
          aria-hidden={isHydrating}
        >
          {isHydrating ? chapterTrimmed || "88" : chapterTrimmed}
        </span>
      </span>
    ) : (
      <span className="bible-yv-passage-chip-value">
        {visibleLabel}
        <span className="hdr-trigger-caret" aria-hidden>
          ⌄
        </span>
      </span>
    );

  return (
    <HeaderTriggerButton
      open={open}
      onClick={onClick}
      shape="pill"
      idleLabel={idleLabel}
      ariaLabel={ariaLabel}
      ariaControls={panelId}
      ariaHaspopup="dialog"
      title={isHydrating ? undefined : title}
      disabled={disabled || isHydrating}
      className={`bible-yv-passage-chip is-${variant}${
        isHydrating ? " is-hydrating" : ""
      }`}
    />
  );
}
