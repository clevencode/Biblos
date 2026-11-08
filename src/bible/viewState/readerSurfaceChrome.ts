/**
 * Superfície de leitura — inert, scrim, classes root (doc bible-offline-first-ui QA 13–14).
 */

export type ReaderSurfaceChromeInput = {
  pickerOpen: boolean;
  pickerPanelOpenAllowed: boolean;
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

export function readerSurfaceChrome(
  input: ReaderSurfaceChromeInput,
): ReaderSurfaceChrome {
  const passagePickerRollOpen =
    input.pickerOpen && input.pickerPanelOpenAllowed;
  const passageInputBlocked =
    passagePickerRollOpen ||
    input.toolsMenuOpen ||
    input.historyOpen ||
    input.shareSheetOpen;
  const passageSurfaceScrimOpen =
    passagePickerRollOpen || input.historyOpen || input.shareSheetOpen;
  const toolsMenuPassThroughDismiss =
    input.toolsMenuOpen && !passageSurfaceScrimOpen;

  return {
    passagePickerRollOpen,
    passageInputBlocked,
    passageSurfaceScrimOpen,
    toolsMenuPassThroughDismiss,
    forceChromeVisible:
      passageInputBlocked ||
      input.pickerOpen ||
      input.verseActionsOpen,
    rootClassPassageRollOpen: passagePickerRollOpen,
    scrimIsTools:
      input.toolsMenuOpen &&
      (passagePickerRollOpen || input.historyOpen || input.shareSheetOpen),
    scrimIsPickerDismiss: passagePickerRollOpen,
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
