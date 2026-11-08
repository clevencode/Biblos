import type { PassageLoadErrorKind } from "../passageLoadError";
import { PASSAGE_LOADING_COPY } from "./loadingConstants";
import type { PassageViewState } from "./types";

/** Apresentação derivada — única fonte para aria-busy, skeleton e labels. */
export type PassagePresentation = {
  inFlight: boolean;
  showDeferredUi: boolean;
  isOpening: boolean;
  isReloading: boolean;
  /** Skeleton dimensional + lead (após PASSAGE_LOADING_DEFER_MS). */
  showOpeningSkeleton: boolean;
  ariaBusy: boolean;
  statusLine: "opening" | "reload" | "idle";
};

export function passagePresentation(input: {
  viewState: PassageViewState;
  loading: boolean;
  showDeferredUi: boolean;
}): PassagePresentation {
  const isOpening =
    input.viewState.status === "loading" && !input.viewState.stalePassage;
  const isReloading =
    input.viewState.status === "loading" &&
    input.viewState.reload &&
    Boolean(input.viewState.stalePassage);

  let statusLine: PassagePresentation["statusLine"] = "idle";
  if (isOpening && input.showDeferredUi) statusLine = "opening";
  else if (isReloading) statusLine = "reload";

  const showOpeningSkeleton = isOpening && input.showDeferredUi;

  return {
    inFlight: input.loading,
    showDeferredUi: input.showDeferredUi,
    isOpening,
    isReloading,
    showOpeningSkeleton,
    ariaBusy: input.loading || input.showDeferredUi,
    statusLine,
  };
}

export function passageChapterLoadingLead(
  presentation: Pick<PassagePresentation, "isReloading">,
): string {
  return presentation.isReloading
    ? PASSAGE_LOADING_COPY.reloadingChapter
    : PASSAGE_LOADING_COPY.openingChapter;
}

export function passageLiveStatusLabel(input: {
  presentation: PassagePresentation;
  locationLabel: string;
  error: string | null;
}): string {
  if (input.error) return input.error;
  if (input.presentation.statusLine === "opening") {
    return PASSAGE_LOADING_COPY.openingChapter;
  }
  if (input.presentation.statusLine === "reload") {
    return PASSAGE_LOADING_COPY.reloadingChapter;
  }
  return input.locationLabel;
}

export type BibleReaderError =
  | { domain: "passage"; message: string; kind: PassageLoadErrorKind }
  | { domain: "chrome"; message: string };

/** Gate téléchargement — sans versets em memória (texte em stale reload mantém-se). */
export function showOfflineChapterGate(input: {
  passageErrorKind: PassageLoadErrorKind;
  localBundledAvailable: boolean;
  versesInMemory: boolean;
}): boolean {
  return (
    input.passageErrorKind === "offline_not_cached" &&
    !input.localBundledAvailable &&
    !input.versesInMemory
  );
}

export function mergeBibleReaderErrors(
  passageMessage: string | null,
  passageKind: PassageLoadErrorKind,
  chromeMessage: string | null,
): BibleReaderError | null {
  if (passageMessage) {
    return { domain: "passage", message: passageMessage, kind: passageKind };
  }
  if (chromeMessage) {
    return { domain: "chrome", message: chromeMessage };
  }
  return null;
}

export function bibleReaderErrorMessage(err: BibleReaderError | null): string | null {
  return err?.message ?? null;
}
