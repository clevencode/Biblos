/**
 * Superfície de leitura — inert, scrim, classes root (doc bible-offline-first-ui QA 13–14).
 */

export type ReaderSurfaceChromeInput = {
  pickerOpen: boolean;
  pickerPanelOpenAllowed: boolean;
  wordSearchOpen?: boolean;
  bookSearchOpen?: boolean;
  toolsMenuOpen: boolean;
  historyOpen: boolean;
  shareSheetOpen: boolean;
  verseActionsOpen: boolean;
  verseStudyOpen?: boolean;
};

export type ReaderSurfaceChrome = {
  passagePickerRollOpen: boolean;
  passageInputBlocked: boolean;
  passageSurfaceScrimOpen: boolean;
  /** Legado: dismiss por toque na passagem sem scrim (desligado — tools usa o mesmo scrim do book modal). */
  toolsMenuPassThroughDismiss: boolean;
  forceChromeVisible: boolean;
  rootClassPassageRollOpen: boolean;
  scrimIsTools: boolean;
  scrimIsPickerDismiss: boolean;
};

export type OverlayDismissTarget =
  | "picker"
  | "wordSearch"
  | "bookSearch"
  | "tools"
  | "history"
  | "share"
  | "verseStudy";

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
  const bookSearchOpen = Boolean(input.bookSearchOpen);
  const verseStudyOpen = Boolean(input.verseStudyOpen);
  /** Chip roll ou painel palavras — mesma elevação de chrome. */
  const barOverlayOpen = rollOpen || wordSearchOpen || bookSearchOpen;
  /**
   * Modais com `.top-sheet-backdrop` (padrão hub do cabeçalho).
   * Exclui verse_actions (sheet de versículo) e word search (painel full-bleed).
   */
  const passageInputBlocked =
    barOverlayOpen ||
    input.toolsMenuOpen ||
    input.historyOpen ||
    input.shareSheetOpen ||
    verseStudyOpen;
  const passageSurfaceScrimOpen =
    rollOpen ||
    bookSearchOpen ||
    input.toolsMenuOpen ||
    input.historyOpen ||
    input.shareSheetOpen ||
    verseStudyOpen;
  const toolsMenuPassThroughDismiss = false;

  return {
    passagePickerRollOpen: rollOpen,
    passageInputBlocked,
    passageSurfaceScrimOpen,
    toolsMenuPassThroughDismiss,
    forceChromeVisible:
      passageInputBlocked ||
      input.pickerOpen ||
      wordSearchOpen ||
      bookSearchOpen ||
      verseStudyOpen ||
      input.verseActionsOpen,
    /* Classe no root/header p/ roll aberto; elevação topbar = .is-top-sheet-open */
    rootClassPassageRollOpen: barOverlayOpen,
    scrimIsTools: input.toolsMenuOpen || input.historyOpen || verseStudyOpen,
    scrimIsPickerDismiss:
      barOverlayOpen ||
      input.toolsMenuOpen ||
      input.historyOpen ||
      verseStudyOpen,
  };
}

/** Prioridade de fecho com um toque no scrim (picker → wordSearch → tools → …). */
export function overlayDismissTarget(
  input: ReaderSurfaceChromeInput,
): OverlayDismissTarget | null {
  const { passagePickerRollOpen } = readerSurfaceChrome(input);
  if (passagePickerRollOpen) return "picker";
  if (input.wordSearchOpen) return "wordSearch";
  if (input.bookSearchOpen) return "bookSearch";
  if (input.verseStudyOpen) return "verseStudy";
  if (input.toolsMenuOpen) return "tools";
  if (input.historyOpen) return "history";
  if (input.shareSheetOpen) return "share";
  return null;
}
