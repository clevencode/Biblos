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
  marksOpen?: boolean;
  shareSheetOpen: boolean;
  /**
   * Secção Options (verse_actions): chrome visível, mas **pass-through** na passagem
   * (não entra em `passageInputBlocked` nem `overlayDismissTarget`) —
   * o utilizador continua a seleccionar versos; fecho só via pill Options / Escape.
   */
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
  | "marks"
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
  const marksOpen = Boolean(input.marksOpen);
  const verseStudyOpen = Boolean(input.verseStudyOpen);
  /** Chip roll ou painel palavras — mesma elevação de chrome. */
  const barOverlayOpen = rollOpen || wordSearchOpen || bookSearchOpen;
  /**
   * Modais com `.top-sheet-backdrop`.
   * Full-bleed (search / book roll / history / marks / menu header) — sem scrim.
   * Options (`verseActionsOpen`) omitido de propósito: pass-through para multi-select.
   */
  const passageInputBlocked =
    barOverlayOpen ||
    input.toolsMenuOpen ||
    input.historyOpen ||
    marksOpen ||
    input.shareSheetOpen ||
    verseStudyOpen;
  const passageSurfaceScrimOpen =
    bookSearchOpen || input.shareSheetOpen || verseStudyOpen;
  const toolsMenuPassThroughDismiss = false;

  return {
    passagePickerRollOpen: rollOpen,
    passageInputBlocked,
    passageSurfaceScrimOpen,
    toolsMenuPassThroughDismiss,
    /* Options: força chrome (topbar Options) sem bloquear a passagem. */
    forceChromeVisible:
      passageInputBlocked ||
      input.pickerOpen ||
      wordSearchOpen ||
      bookSearchOpen ||
      verseStudyOpen ||
      input.verseActionsOpen,
    /* Classe no root/header p/ roll aberto; elevação topbar = .is-top-sheet-open */
    rootClassPassageRollOpen: barOverlayOpen,
    scrimIsTools:
      input.toolsMenuOpen || input.historyOpen || marksOpen || verseStudyOpen,
    scrimIsPickerDismiss:
      barOverlayOpen ||
      input.toolsMenuOpen ||
      input.historyOpen ||
      marksOpen ||
      verseStudyOpen,
  };
}

/**
 * Prioridade de fecho com um toque no scrim (picker → wordSearch → tools → …).
 * `verseActionsOpen` nunca é alvo: fecho só pelo pill Options / Escape.
 */
export function overlayDismissTarget(
  input: ReaderSurfaceChromeInput,
): OverlayDismissTarget | null {
  const { passagePickerRollOpen } = readerSurfaceChrome(input);
  if (passagePickerRollOpen) return "picker";
  if (input.wordSearchOpen) return "wordSearch";
  if (input.bookSearchOpen) return "bookSearch";
  if (input.verseStudyOpen) return "verseStudy";
  if (input.toolsMenuOpen) return "tools";
  if (input.marksOpen) return "marks";
  if (input.historyOpen) return "history";
  if (input.shareSheetOpen) return "share";
  return null;
}
