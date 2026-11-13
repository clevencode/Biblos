import { useCallback, useRef, useState } from "react";

export type ActiveBibleOverlay =
  | { type: "none" }
  | { type: "word_search" }
  | { type: "passage_picker" }
  | { type: "book_search" }
  | { type: "verse_actions"; selectedVerseIds: string[] }
  | { type: "reader_settings" }
  | { type: "history" };

export type ActiveBibleOverlayType = ActiveBibleOverlay["type"];

export type ToggleableBibleOverlayType = Exclude<ActiveBibleOverlayType, "none">;

export function hasActiveBibleOverlay(overlay: ActiveBibleOverlay): boolean {
  return overlay.type !== "none";
}

export function isOverlayType<T extends ActiveBibleOverlayType>(
  overlay: ActiveBibleOverlay,
  type: T,
): overlay is Extract<ActiveBibleOverlay, { type: T }> {
  return overlay.type === type;
}

export type UseBibleOverlayControllerArgs = {
  /** Limpa seleção visual de versículos ao sair de `verse_actions`. */
  onClearVerseSelection?: () => void;
};

/**
 * Estado único mutuamente exclusivo dos overlays da tela Bible.
 * Abrir um tipo substitui o anterior; sair de `verse_actions` limpa a seleção.
 */
export function useBibleOverlayController(
  args: UseBibleOverlayControllerArgs = {},
) {
  const [activeOverlay, setActiveOverlay] = useState<ActiveBibleOverlay>({
    type: "none",
  });
  const clearSelectionRef = useRef(args.onClearVerseSelection);
  clearSelectionRef.current = args.onClearVerseSelection;

  const leaveVerseActionsIfNeeded = useCallback(
    (prev: ActiveBibleOverlay, next: ActiveBibleOverlay) => {
      if (prev.type === "verse_actions" && next.type !== "verse_actions") {
        clearSelectionRef.current?.();
      }
    },
    [],
  );

  const openOverlay = useCallback(
    (next: ActiveBibleOverlay) => {
      setActiveOverlay((prev) => {
        if (
          prev.type === next.type &&
          next.type !== "verse_actions" &&
          prev.type !== "verse_actions"
        ) {
          return prev;
        }
        if (
          prev.type === "verse_actions" &&
          next.type === "verse_actions" &&
          prev.selectedVerseIds.length === next.selectedVerseIds.length &&
          prev.selectedVerseIds.every((id, i) => id === next.selectedVerseIds[i])
        ) {
          return prev;
        }
        leaveVerseActionsIfNeeded(prev, next);
        return next;
      });
    },
    [leaveVerseActionsIfNeeded],
  );

  const closeOverlay = useCallback(() => {
    setActiveOverlay((prev) => {
      if (prev.type === "none") return prev;
      leaveVerseActionsIfNeeded(prev, { type: "none" });
      return { type: "none" };
    });
  }, [leaveVerseActionsIfNeeded]);

  const toggleOverlay = useCallback(
    (targetType: ToggleableBibleOverlayType) => {
      setActiveOverlay((prev) => {
        if (prev.type === targetType) {
          leaveVerseActionsIfNeeded(prev, { type: "none" });
          return { type: "none" };
        }
        const next: ActiveBibleOverlay =
          targetType === "verse_actions"
            ? { type: "verse_actions", selectedVerseIds: [] }
            : { type: targetType };
        leaveVerseActionsIfNeeded(prev, next);
        return next;
      });
    },
    [leaveVerseActionsIfNeeded],
  );

  return {
    activeOverlay,
    hasActiveModal: hasActiveBibleOverlay(activeOverlay),
    openOverlay,
    closeOverlay,
    toggleOverlay,
  };
}
