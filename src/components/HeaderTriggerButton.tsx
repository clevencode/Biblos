import type { ReactNode } from "react";
import { YvIcon, type BiblosIconName } from "./YvIcon";

export type HeaderTriggerShape = "circle" | "pill";

type HeaderTriggerButtonProps = {
  open: boolean;
  onClick: () => void;
  shape?: HeaderTriggerShape;
  /** Ícone idle (circle ou pill sem label). */
  idleIcon?: BiblosIconName;
  /** Conteúdo idle da pílula (ex.: ref livro/capítulo). */
  idleLabel?: ReactNode;
  /** Largura mínima estável. */
  pillMinWidth?: number | string;
  ariaLabel: string;
  ariaControls?: string;
  ariaHaspopup?: "dialog" | "menu" | "true" | boolean;
  title?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Trigger do cabeçalho Bible — padrão tátil do hub radial.
 * Circle: idle ícone ↔ ✕. Pill: open mostra label + ✕ juntos.
 */
export function HeaderTriggerButton({
  open,
  onClick,
  shape = "circle",
  idleIcon,
  idleLabel,
  pillMinWidth,
  ariaLabel,
  ariaControls,
  ariaHaspopup,
  title,
  disabled = false,
  className = "",
}: HeaderTriggerButtonProps) {
  const shapeClass = shape === "pill" ? " is-pill" : " is-circle";
  const openClass = open ? " is-open is-active" : "";
  const keepPillLabel = shape === "pill" && idleLabel != null;
  const style =
    shape === "pill" && pillMinWidth != null
      ? {
          minWidth:
            typeof pillMinWidth === "number" ? `${pillMinWidth}px` : pillMinWidth,
        }
      : undefined;

  return (
    <button
      type="button"
      className={`hdr-trigger${shapeClass}${openClass}${className ? ` ${className}` : ""}`}
      style={style}
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-controls={ariaControls}
      aria-haspopup={ariaHaspopup === true ? "true" : ariaHaspopup || undefined}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="hdr-trigger-swap" aria-hidden={false}>
        <span
          className={`hdr-icon-idle${
            open && !keepPillLabel ? " is-hidden" : ""
          }`}
        >
          {idleLabel != null ? (
            <span className="hdr-trigger-label">{idleLabel}</span>
          ) : idleIcon ? (
            <YvIcon name={idleIcon} className="hdr-trigger-icon" />
          ) : null}
        </span>
        <span className={`hdr-icon-exit${open ? " is-shown" : ""}`}>
          <YvIcon name="close" className="hdr-trigger-icon hdr-trigger-exit-icon" />
        </span>
      </span>
    </button>
  );
}
