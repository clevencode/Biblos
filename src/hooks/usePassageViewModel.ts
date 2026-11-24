import { useCallback, useEffect, useReducer, useRef } from "react";
import type { YouVersionBible, YouVersionBook, YouVersionPassage } from "../youversion/client";
import { chapterUsfm } from "../youversion/client";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { loadPassageViewState, resolvePassageLayout } from "../bible/passageRepository";
import type { PassageLoadErrorKind } from "../bible/passageLoadError";
import {
  peekPassageWindow,
  prefetchAdjacentPassages,
  putPassageWindow,
} from "../bible/passageWindowCache";
import {
  displayPassageFromViewState,
  initialPassageViewState,
  isPassageLoading,
  passageReducer,
} from "../bible/viewState/passageReducer";
import { passagePresentation } from "../bible/viewState/selectors";
import type { PassageLayoutSchema } from "../bible/viewState/types";

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
    books,
    catalogOffline,
    offlineReady,
    resolveBookTitle,
    onResolved,
  } = options;

  const textVersionRef = useRef(textVersion);
  textVersionRef.current = textVersion;
  const booksRef = useRef(books);
  booksRef.current = books;
  const resolveBookTitleRef = useRef(resolveBookTitle);
  resolveBookTitleRef.current = resolveBookTitle;

  const [viewState, dispatch] = useReducer(passageReducer, initialPassageViewState);
  const loadGen = useRef(0);

  const loading = isPassageLoading(viewState);

  useEffect(() => {
    if (active) return;
    loadGen.current += 1;
  }, [active]);

  const passage = displayPassageFromViewState(viewState);

  const error =
    viewState.status === "error" ? viewState.message : null;
  const passageErrorKind: PassageLoadErrorKind =
    viewState.status === "error" ? viewState.errorKind : "generic";

  const activeSchema: PassageLayoutSchema | null =
    viewState.status === "idle" ? viewState.schema : viewState.schema;

  const presentation = passagePresentation({
    viewState,
    loading,
  });

  const loadChapter = useCallback(
    async (
      nextBook: string,
      nextChapter: string,
      verse: number | null,
      _verseEnd: number | null,
    ) => {
      const gen = ++loadGen.current;
      const version = textVersionRef.current;
      const bookTitle = resolveBookTitleRef.current(nextBook);

      const cached = peekPassageWindow(version, nextBook, nextChapter);
      if (cached) {
        if (gen !== loadGen.current) return;
        dispatch({ type: "NAVIGATE", schema: cached.schema });
        dispatch({
          type: "RESOLVE_OK",
          schema: cached.schema,
          passage: cached.passage,
          bibleId: cached.bibleId,
          bible: cached.bible,
        });
        const label =
          verse != null
            ? `${bookTitle} ${nextChapter}.${verse}`
            : `${bookTitle} ${nextChapter}`;
        onResolved?.({
          bookId: nextBook,
          chapterId: nextChapter,
          verse,
          passage: cached.passage,
          bibleId: cached.bibleId ?? 0,
          bible: cached.bible ?? undefined,
          label,
        });
        prefetchAdjacentPassages({
          version,
          books: booksRef.current,
          bookId: nextBook,
          chapterId: nextChapter,
          resolveBookTitle: resolveBookTitleRef.current,
          catalogOffline,
          offlineIndexReady: offlineReady,
        });
        return;
      }

      const schema = await resolvePassageLayout({
        bookId: nextBook,
        chapterId: nextChapter,
        bookTitle,
      });
      if (gen !== loadGen.current) return;
      dispatch({ type: "NAVIGATE", schema });

      const result = await loadPassageViewState({
        version,
        bookId: nextBook,
        chapterId: nextChapter,
        bookTitle,
        catalogOffline,
        offlineIndexReady: offlineReady,
        schema,
      });

      if (gen !== loadGen.current) return;

      if (result.status === "success") {
        putPassageWindow(version, nextBook, nextChapter, result);
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
        prefetchAdjacentPassages({
          version,
          books: booksRef.current,
          bookId: nextBook,
          chapterId: nextChapter,
          resolveBookTitle: resolveBookTitleRef.current,
          catalogOffline,
          offlineIndexReady: offlineReady,
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
    [catalogOffline, offlineReady, onResolved],
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
    error,
    passageErrorKind,
    activeSchema,
    presentation,
    loadChapter,
    retryChapter,
    currentUsfm: (bookId: string, chapterId: string) => chapterUsfm(bookId, chapterId),
  };
}
