/**
 * Backdrop contextual do menu radial (fog + blur).
 * Visual partilhado com modais do leitor via `.contextual-ui-backdrop`
 * (picker, tools, history, share, word search — não verse_actions).
 * Irmão de .mode-tabs; z-index abaixo da barra/arco.
 */

import { useEffect, type CSSProperties } from "react";
import { CONVEX_HUB_SIZE_PX } from "./ConvexBottomBarSurface";

/** Clear = hub flutuante (+ folga caption); sem barra convexa. */
type RadialUiBackdropProps = {
  isOpen: boolean;
  onClose: () => void;
  lockScroll?: boolean;
  className?: string;
  closeLabel?: string;
};

export function RadialUiBackdrop({
  isOpen,
  onClose,
  lockScroll = true,
  className = "",
  closeLabel = "Close",
}: RadialUiBackdropProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !lockScroll) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, lockScroll]);

  const style = {
    ["--radial-backdrop-bar" as string]: `${CONVEX_HUB_SIZE_PX + 22}px`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`contextual-ui-backdrop radial-ui-backdrop${isOpen ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      aria-label={closeLabel}
      aria-hidden={!isOpen}
      tabIndex={isOpen ? 0 : -1}
      onClick={onClose}
    />
  );
}
