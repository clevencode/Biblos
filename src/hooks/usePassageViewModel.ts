import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { YouVersionBible, YouVersionBook, YouVersionPassage } from "../youversion/client";
import { chapterUsfm } from "../youversion/client";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { loadPassageViewState, resolvePassageLayout } from "../bible/passageRepository";
import type { PassageLoadErrorKind } from "../bible/passageLoadError";
import {
  displayPassageFromViewState,
  initialPassageViewState,
  isPassageLoading,
  passageReducer,
} from "../bible/viewState/passageReducer";
import type { PassageSkeletonSchema } from "../bible/viewState/types";

const LOADING_UI_DELAY_MS = 120;

export type PassageLoadOutcome = {
  bookId: string;
  chapterId: string;
  verse: number | null;
  passage: YouVersionPassage;
  bibleId: number;
  bible?: YouVersionBible;
  label: string;
};

export type UsePassageViewModelOptions = {
  active: boolean;
  textVersion: BibleTextVersionId;
  books: YouVersionBook[];
  catalogOffline: boolean;
  offlineReady: boolean;
  resolveBookTitle: (bookId: string) => string;
  onResolved?: (outcome: PassageLoadOutcome) => void;
};

export function usePassageViewModel(options: UsePassageViewModelOptions) {
  const {
    active,
    textVersion,
    catalogOffline,
    offlineReady,
    resolveBookTitle,
    onResolved,
  } = options;

  const textVersionRef = useRef(textVersion);
  textVersionRef.current = textVersion;

  const [viewState, dispatch] = useReducer(passageReducer, initialPassageViewState);
  const [loadingUi, setLoadingUi] = useState(false);
  const loadGen = useRef(0);

  const loading = isPassageLoading(viewState);

  useEffect(() => {
    if (!loading) {
      setLoadingUi(false);
      return;
    }
    const id = window.setTimeout(() => setLoadingUi(true), LOADING_UI_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [loading]);

  useEffect(() => {
    if (active) return;
    loadGen.current += 1;
    dispatch({ type: "RESET" });
  }, [active]);

  const passage = displayPassageFromViewState(viewState);

  const error =
    viewState.status === "error" ? viewState.message : null;
  const passageErrorKind: PassageLoadErrorKind =
    viewState.status === "error" ? viewState.errorKind : "generic";

  const activeSchema: PassageSkeletonSchema | null =
    viewState.status === "idle" ? viewState.schema : viewState.schema;

  const isReloading =
    viewState.status === "loading" && viewState.reload && Boolean(viewState.stalePassage);

  const isOpening =
    viewState.status === "loading" && !viewState.stalePassage;

  const loadChapter = useCallback(
    async (
      nextBook: string,
      nextChapter: string,
      verse: number | null,
      _verseEnd: number | null,
    ) => {
      const gen = ++loadGen.current;
      const bookTitle = resolveBookTitle(nextBook);
      const schema = await resolvePassageLayout({
        bookId: nextBook,
        chapterId: nextChapter,
        bookTitle,
      });
      if (gen !== loadGen.current) return;
      dispatch({ type: "NAVIGATE", schema });

      const result = await loadPassageViewState({
        version: textVersionRef.current,
        bookId: nextBook,
        chapterId: nextChapter,
        bookTitle,
        catalogOffline,
        offlineIndexReady: offlineReady,
      });

      if (gen !== loadGen.current) return;

      if (result.status === "success") {
        dispatch({
          type: "RESOLVE_OK",
          schema: result.schema,
          passage: result.passage,
          bibleId: result.bibleId,
          bible: result.bible,
        });
        const label =
          verse != null
            ? `${bookTitle} ${nextChapter}.${verse}`
            : `${bookTitle} ${nextChapter}`;
        onResolved?.({
          bookId: nextBook,
          chapterId: nextChapter,
          verse,
          passage: result.passage,
          bibleId: result.bibleId ?? 0,
          bible: result.bible ?? undefined,
          label,
        });
        return;
      }

      if (result.status === "error") {
        dispatch({
          type: "RESOLVE_ERR",
          schema: result.schema,
          errorKind: result.errorKind,
          message: result.message,
        });
      }
    },
    [catalogOffline, offlineReady, onResolved, resolveBookTitle],
  );

  const retryChapter = useCallback(
    (bookId: string, chapterId: string) => {
      void loadChapter(bookId, chapterId, null, null);
    },
    [loadChapter],
  );

  return {
    viewState,
    passage,
    loading,
    loadingUi,
    error,
    passageErrorKind,
    activeSchema,
    isReloading,
    isOpening,
    loadChapter,
    retryChapter,
    currentUsfm: (bookId: string, chapterId: string) => chapterUsfm(bookId, chapterId),
  };
}
