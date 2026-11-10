/**
 * Superfície de leitura — inert, scrim, classes root (doc bible-offline-first-ui QA 13–14).
 */

export type ReaderSurfaceChromeInput = {
  pickerOpen: boolean;
  pickerPanelOpenAllowed: boolean;
  wordSearchOpen?: boolean;
  toolsMenuOpen: boolean;
  historyOpen: boolean;
  shareSheetOpen: boolean;
  verseActionsOpen: boolean;
};

export type ReaderSurfaceChrome = {
  passagePickerRollOpen: boolean;
  passageInputBlocked: boolean;
  passageSurfaceScrimOpen: boolean;
  /** Menu tools: inert na passagem mas sem scrim (popover desce sobre o texto). */
  toolsMenuPassThroughDismiss: boolean;
  forceChromeVisible: boolean;
  rootClassPassageRollOpen: boolean;
  scrimIsTools: boolean;
  scrimIsPickerDismiss: boolean;
};

export type OverlayDismissTarget = "picker" | "tools" | "history" | "share";

export const OVERLAY_DISMISS_SWALLOW_MS = 480;

/** Roll do picker — única fonte (catálogo liberado + picker aberto). */
export function passagePickerRollOpen(
  pickerOpen: boolean,
  pickerPanelOpenAllowed: boolean,
): boolean {
  return pickerOpen && pickerPanelOpenAllowed;
}

export function readerSurfaceChrome(
  input: ReaderSurfaceChromeInput,
): ReaderSurfaceChrome {
  const rollOpen = passagePickerRollOpen(
    input.pickerOpen,
    input.pickerPanelOpenAllowed,
  );
  const wordSearchOpen = Boolean(input.wordSearchOpen);
  const passageInputBlocked =
    rollOpen ||
    wordSearchOpen ||
    input.toolsMenuOpen ||
    input.historyOpen ||
    input.shareSheetOpen;
  const passageSurfaceScrimOpen =
    rollOpen || wordSearchOpen || input.historyOpen || input.shareSheetOpen;
  const toolsMenuPassThroughDismiss =
    input.toolsMenuOpen && !passageSurfaceScrimOpen;

  return {
    passagePickerRollOpen: rollOpen,
    passageInputBlocked,
    passageSurfaceScrimOpen,
    toolsMenuPassThroughDismiss,
    forceChromeVisible:
      passageInputBlocked ||
      input.pickerOpen ||
      wordSearchOpen ||
      input.verseActionsOpen,
    rootClassPassageRollOpen: rollOpen,
    scrimIsTools:
      input.toolsMenuOpen &&
      (rollOpen || input.historyOpen || input.shareSheetOpen),
    scrimIsPickerDismiss: rollOpen,
  };
}

/** Prioridade de fecho com um toque no scrim (picker → tools → history → share). */
export function overlayDismissTarget(
  input: ReaderSurfaceChromeInput,
): OverlayDismissTarget | null {
  const { passagePickerRollOpen } = readerSurfaceChrome(input);
  if (passagePickerRollOpen) return "picker";
  if (input.toolsMenuOpen) return "tools";
  if (input.historyOpen) return "history";
  if (input.shareSheetOpen) return "share";
  return null;
}
