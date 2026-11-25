import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { passageDiscoverySplitSearch } from "../bible/passageDiscoveryFlow";
import { passagePickerSkipsVerseStep } from "../bible/passagePickerFlow";
import {
  EMPTY_PASSAGE_DISCOVERY_SESSION,
  type PassageDiscoverySession,
} from "../bible/passageDiscovery/session";
import {
  readPickGridScroll,
  writePickGridScroll,
  type PickGridScrollKind,
  type PickGridScrollMemory,
} from "../bible/passageDiscovery/pickGridScroll";
import {
  passagePickerRollOpen,
} from "../bible/viewState/readerSurfaceChrome";
import { usePassageDiscovery } from "./usePassageDiscovery";
import { usePersistentSearchSession } from "./usePersistentSearchSession";
import { useWordPassageSearch } from "./useWordPassageSearch";
import type { YouVersionBook } from "../youversion/client";

export type PassageBarStep = "book" | "chapter" | "verse";

export type UsePassageBarControllerArgs = {
  pickerPanelOpenAllowed: boolean;
  /** Controlado pelo overlay único da tela Bible. */
  pickerOpen: boolean;
  wordSearchOpen: boolean;
  requestOpenPassagePicker: () => void;
  requestClosePicker: () => void;
  requestToggleWordSearch: () => void;
  requestCloseWordSearch: () => void;
  books: YouVersionBook[];
  textVersion: BibleTextVersionId;
  bookId: string;
  chapterId: string;
  passageId: string | null | undefined;
  presentationInFlight: boolean;
  markOverlayDismissSwallow: () => void;
};

/**
 * Orquestração da BiblePassageBar (layout test + legacy):
 * chip/roll, word search, discovery sessions.
 * Abertura/fecho de picker e word search é controlada pelo overlay único.
 */
export function usePassageBarController({
  pickerPanelOpenAllowed,
  pickerOpen,
  wordSearchOpen,
  requestOpenPassagePicker,
  requestClosePicker,
  requestToggleWordSearch,
  requestCloseWordSearch,
  books,
  textVersion,
  bookId,
  chapterId,
  passageId,
  presentationInFlight,
  markOverlayDismissSwallow,
}: UsePassageBarControllerArgs) {
  const [passageStep, setPassageStep] = useState<PassageBarStep>("book");
  /**
   * Livro sob consulta no picker (passo chapter/verse).
   * Null = usar o bookId do leitor; limpar ao voltar à lista / fechar.
   */
  const [pickerBookId, setPickerBookId] = useState<string | null>(null);
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  /** Barra de pesquisa do book picker — fechada ao abrir o picker. */
  const [pickSearchOpen, setPickSearchOpen] = useState(false);
  const {
    query: wordSearchQuery,
    scopeFilter: wordSearchScopeFilter,
    selectedBookIds: wordSearchSelectedBookIds,
    page: wordSearchSessionPage,
    setQuery: setWordSearchQuery,
    setScopeFilter: setWordSearchScopeFilter,
    setSelectedBookIds: setWordSearchSelectedBookIds,
    setPage: setWordSearchSessionPage,
    clearSearch: clearWordSearchSession,
    resetForVersion: resetWordSearchForVersion,
  } = usePersistentSearchSession(textVersion);

  const prevTextVersionRef = useRef(textVersion);
  useEffect(() => {
    if (prevTextVersionRef.current === textVersion) return;
    prevTextVersionRef.current = textVersion;
    resetWordSearchForVersion();
  }, [textVersion, resetWordSearchForVersion]);
  const [discoverySession, setDiscoverySession] = useState<PassageDiscoverySession>(
    () => ({ ...EMPTY_PASSAGE_DISCOVERY_SESSION }),
  );

  // Sessões antigas em "all" sem livros → default de negócio (livro atual).
  useEffect(() => {
    if (!wordSearchOpen) return;
    if (wordSearchScopeFilter !== "all") return;
    if (wordSearchSelectedBookIds.length > 0) return;
    const id = String(bookId || "")
      .trim()
      .toUpperCase();
    if (!id) return;
    setWordSearchScopeFilter("current_book");
  }, [
    wordSearchOpen,
    wordSearchScopeFilter,
    wordSearchSelectedBookIds.length,
    bookId,
    setWordSearchScopeFilter,
  ]);

  /** Scroll das grelhas do picker — só refs (sem setState no gesto). */
  const pickGridScrollRef = useRef<PickGridScrollMemory>({
    listScrollTop: 0,
    listScrollTouched: false,
    chapterScrollByBook: {},
    verseGridScrollByChapter: {},
  });
  /** Scroll das listas de versículos expandidas na discovery — ref + flush pontual. */
  const verseListScrollRef = useRef<Record<string, number>>({});
  const pendingVerseStep = useRef(false);
  /** Último passo útil ao reabrir o pill (capítulo após escolher número). */
  const reopenPassageStepRef = useRef<"book" | "chapter">("book");
  const passageStepRef = useRef<PassageBarStep>(passageStep);
  passageStepRef.current = passageStep;

  useEffect(() => {
    if (passageStep === "book") return;
    setPickSearchOpen(false);
    setBookSearchQuery("");
  }, [passageStep]);
  const passageRollRef = useRef<HTMLDivElement | null>(null);
  const wordSearchChromeRef = useRef<HTMLDivElement | null>(null);
  const wordSearchPanelId = useId();
  const passagePickerPanelId = useId();

  const discoverySplitSearch = passageDiscoverySplitSearch();

  const passageRollOpen = useMemo(
    () => passagePickerRollOpen(pickerOpen, pickerPanelOpenAllowed),
    [pickerOpen, pickerPanelOpenAllowed],
  );

  const passageDiscoveryEnabled = passageRollOpen && passageStep === "book";
  const { result: passageDiscovery, busy: passageDiscoveryBusy } = usePassageDiscovery(
    bookSearchQuery,
    books,
    passageDiscoveryEnabled,
    textVersion,
    discoverySplitSearch ? "books" : "full",
  );

  const {
    hits: wordVerseHits,
    total: wordVerseTotal,
    page: wordSearchPage,
    pageCount: wordSearchPageCount,
    setPage: setWordSearchPage,
    busy: wordDiscoveryBusy,
    paging: wordSearchPaging,
    error: wordSearchError,
    matchMode: wordMatchMode,
    matchedTerms: wordMatchedTerms,
    facets: wordSearchFacets,
    scopeCounts: wordSearchScopeCounts,
  } = useWordPassageSearch(wordSearchQuery, wordSearchOpen, textVersion, {
    scopeFilter: wordSearchScopeFilter,
    selectedBookIds: wordSearchSelectedBookIds,
    currentBookId: bookId,
    page: wordSearchSessionPage,
    onPageChange: setWordSearchSessionPage,
  });

  /** Compatível com o painel (só `contentError`). */
  const wordDiscovery = useMemo(
    () => ({ contentError: wordSearchError }),
    [wordSearchError],
  );

  const patchDiscoverySession = useCallback(
    (patch: Partial<PassageDiscoverySession>) => {
      setDiscoverySession((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const setPickGridScroll = useCallback(
    (
      kind: PickGridScrollKind,
      bookId: string,
      chapterId: string | undefined,
      scrollTop: number,
    ) => {
      writePickGridScroll(
        pickGridScrollRef.current,
        kind,
        bookId,
        chapterId,
        scrollTop,
      );
    },
    [],
  );

  const getPickGridScroll = useCallback(
    (
      kind: PickGridScrollKind,
      bookId: string,
      chapterId?: string,
    ): number | undefined =>
      readPickGridScroll(pickGridScrollRef.current, kind, bookId, chapterId),
    [],
  );

  const flushVerseListScrollToSession = useCallback(() => {
    const snapshot = { ...verseListScrollRef.current };
    setDiscoverySession((prev) => {
      const prevMap = prev.verseScrollByBook;
      const same =
        Object.keys(snapshot).length === Object.keys(prevMap).length &&
        Object.keys(snapshot).every((key) => prevMap[key] === snapshot[key]);
      if (same) return prev;
      return { ...prev, verseScrollByBook: snapshot };
    });
  }, []);

  const setDiscoveryVerseListScroll = useCallback(
    (nextBookId: string, scrollTop: number) => {
      const id = String(nextBookId || "").toUpperCase();
      if (!id) return;
      verseListScrollRef.current[id] = scrollTop;
    },
    [],
  );

  const setDiscoveryExpandedBook = useCallback(
    (nextBookId: string | null) => {
      flushVerseListScrollToSession();
      patchDiscoverySession({
        expandedBookId: nextBookId ? String(nextBookId).toUpperCase() : null,
      });
    },
    [flushVerseListScrollToSession, patchDiscoverySession],
  );

  const clearBookSearch = useCallback(() => {
    setBookSearchQuery("");
    pickGridScrollRef.current = {
      listScrollTop: 0,
      listScrollTouched: false,
      chapterScrollByBook: {},
      verseGridScrollByChapter: {},
    };
    verseListScrollRef.current = {};
    setDiscoverySession({ ...EMPTY_PASSAGE_DISCOVERY_SESSION });
  }, []);

  const closePickSearch = useCallback(() => {
    setPickSearchOpen(false);
    clearBookSearch();
  }, [clearBookSearch]);

  const togglePickSearch = useCallback(() => {
    setPickSearchOpen((open) => {
      if (open) {
        clearBookSearch();
        return false;
      }
      return true;
    });
  }, [clearBookSearch]);

  const clearWordSearch = useCallback(() => {
    clearWordSearchSession();
  }, [clearWordSearchSession]);

  const restoreWordSearchFocusRef = useRef(true);
  const wordSearchWasOpenRef = useRef(false);

  const closeWordSearch = useCallback(
    (options?: { restoreFocus?: boolean }) => {
      restoreWordSearchFocusRef.current = options?.restoreFocus !== false;
      requestCloseWordSearch();
    },
    [requestCloseWordSearch],
  );

  /** WAI dialog: ao fechar, focus no hamburger (pesquisa saiu da topbar). */
  useLayoutEffect(() => {
    if (wordSearchOpen) {
      wordSearchWasOpenRef.current = true;
      return;
    }
    if (!wordSearchWasOpenRef.current) return;
    wordSearchWasOpenRef.current = false;
    if (!restoreWordSearchFocusRef.current) {
      restoreWordSearchFocusRef.current = true;
      return;
    }
    const trigger =
      (wordSearchChromeRef.current?.querySelector(
        "button.bible-yv-passage-word-search-trigger, button.bible-yv-tools-menu-btn",
      ) as HTMLButtonElement | null) ??
      (document.querySelector(
        ".bible-reader--yv button.bible-yv-tools-menu-btn",
      ) as HTMLButtonElement | null);
    trigger?.focus({ preventScroll: true });
  }, [wordSearchOpen]);

  const restorePickerFocusRef = useRef(true);
  const pickerWasOpenRef = useRef(false);

  const closePicker = useCallback(
    (options?: { restoreFocus?: boolean }) => {
      restorePickerFocusRef.current = options?.restoreFocus !== false;
      const step = passageStepRef.current;
      reopenPassageStepRef.current =
        step === "chapter" || step === "verse" ? "chapter" : "book";
      flushVerseListScrollToSession();
      setPickSearchOpen(false);
      setBookSearchQuery("");
      setPickerBookId(null);
      setPassageStep("book");
      pendingVerseStep.current = false;
      requestClosePicker();
    },
    [requestClosePicker, flushVerseListScrollToSession],
  );

  /** WAI dialog: ao fechar o book pill, focus volta ao chip (exceto navegação). */
  useLayoutEffect(() => {
    if (pickerOpen) {
      pickerWasOpenRef.current = true;
      return;
    }
    if (!pickerWasOpenRef.current) return;
    pickerWasOpenRef.current = false;
    if (!restorePickerFocusRef.current) {
      restorePickerFocusRef.current = true;
      return;
    }
    const chip = passageRollRef.current?.querySelector(
      "button.bible-yv-passage-chip",
    ) as HTMLButtonElement | null;
    chip?.focus({ preventScroll: true });
  }, [pickerOpen]);

  const closeAll = useCallback(() => {
    closePicker();
    closeWordSearch();
  }, [closePicker, closeWordSearch]);

  const openPassagePicker = useCallback(
    (step: "book" | "chapter") => {
      if (!pickerPanelOpenAllowed) return;
      setPickSearchOpen(false);
      setBookSearchQuery("");
      /* Capítulos via acordeão no passo book — sem ecrã chapter. */
      if (step === "chapter") {
        setPickerBookId(bookId);
        setPassageStep("book");
        setDiscoveryExpandedBook(bookId);
      } else {
        setPickerBookId(null);
        setPassageStep("book");
      }
      pendingVerseStep.current = false;
      requestOpenPassagePicker();
    },
    [
      pickerPanelOpenAllowed,
      requestOpenPassagePicker,
      bookId,
      setDiscoveryExpandedBook,
    ],
  );

  const togglePassagePicker = useCallback(
    (step: "book" | "chapter") => {
      if (!pickerPanelOpenAllowed) return;
      if (passageRollOpen && passageStep === "book") {
        if (step === "book") {
          closePicker();
          return;
        }
        const expanded =
          discoverySession.expandedBookId?.toUpperCase() ?? "";
        if (expanded === bookId.toUpperCase()) {
          closePicker();
          return;
        }
        setPickerBookId(bookId);
        setDiscoveryExpandedBook(bookId);
        return;
      }
      if (passageRollOpen && passageStep === "verse" && step === "chapter") {
        setPickerBookId(bookId);
        setDiscoveryExpandedBook(bookId);
        setPassageStep("book");
        return;
      }
      if (passageRollOpen && passageStep === step) {
        closePicker();
        return;
      }
      openPassagePicker(step);
    },
    [
      pickerPanelOpenAllowed,
      passageRollOpen,
      passageStep,
      closePicker,
      openPassagePicker,
      discoverySession.expandedBookId,
      bookId,
      setDiscoveryExpandedBook,
      setPickerBookId,
    ],
  );

  const togglePassagePickerRef = useCallback(() => {
    if (!pickerPanelOpenAllowed) return;
    const rollRelevant =
      passageStep === "book" ||
      passageStep === "chapter" ||
      passageStep === "verse";
    if (passageRollOpen && rollRelevant) {
      closePicker();
      return;
    }
    openPassagePicker(reopenPassageStepRef.current);
  }, [
    pickerPanelOpenAllowed,
    passageStep,
    passageRollOpen,
    closePicker,
    openPassagePicker,
  ]);

  const toggleWordSearch = useCallback(() => {
    if (!wordSearchOpen) {
      setPickerBookId(null);
      setPassageStep("book");
      pendingVerseStep.current = false;
    }
    requestToggleWordSearch();
  }, [wordSearchOpen, requestToggleWordSearch]);

  const armPendingVerseStep = useCallback((armed: boolean) => {
    pendingVerseStep.current = armed;
  }, []);

  /** Passo capítulo/verso: focus no chip (passo livro: focus no input no ScrollPicker). */
  useLayoutEffect(() => {
    if (!pickerOpen || passageStep === "book") return;
    const chip = passageRollRef.current?.querySelector(
      "button.bible-yv-passage-chip.is-chapter, button.bible-yv-passage-chip.is-ref, button.bible-yv-passage-chip",
    ) as HTMLButtonElement | null;
    chip?.focus({ preventScroll: true });
  }, [pickerOpen, passageStep]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!(target instanceof Element)) return;
      if (target.closest(".bible-yv-dock")) return;
      if (target.closest(".bible-yv-passage-roll-scrim")) return;
      /*
       * Topbar: fechar só pelo pill (toggle no chip). Toques no resto do
       * `.bible-yv-top` (skips, vazio, etc.) não dismissam.
       */
      if (target.closest(".bible-yv-top")) return;
      /* Painel / cluster / roll — não fechar ao digitar ou fazer scroll */
      if (
        target.closest(".bible-yv-passage-scroll-panel") ||
        target.closest(".bible-yv-passage-chrome-cluster") ||
        target.closest(".bible-yv-passage-roll") ||
        target.closest(".top-sheet-layer") ||
        passageRollRef.current?.contains(target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      markOverlayDismissSwallow();
      closePicker();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [pickerOpen, markOverlayDismissSwallow, closePicker]);

  useEffect(() => {
    if (!wordSearchOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!(target instanceof Element)) return;
      /* Scrim do leitor — mesmo contrato que o chip (fecho via dismissPassageSurfaceOverlay). */
      if (target.closest(".bible-yv-passage-roll-scrim")) return;
      if (target.closest(".bible-yv-dock")) return;
      if (target.closest(".bible-yv-passage-word-search-trigger")) return;
      /*
       * Topbar: sair só pelo pill «Rechèch» (volta ao menu). Resto do
       * `.bible-yv-top` não dismissa.
       */
      if (target.closest(".bible-yv-top")) return;
      if (target.closest(".top-sheet-layer")) return;
      /* Hamburger / section pill fecha via onClick — não engolir. */
      if (target.closest(".bible-yv-tools-menu")) return;
      if (
        target.closest(".bible-yv-passage-word-search-panel") ||
        target.closest(".bible-yv-passage-chrome-cluster") ||
        wordSearchChromeRef.current?.contains(target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      markOverlayDismissSwallow();
      closeWordSearch();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [wordSearchOpen, markOverlayDismissSwallow, closeWordSearch]);

  useEffect(() => {
    if (!pickerOpen || passageStep !== "book") return;
    /* Não sobrescrever a memória de scroll do utilizador. */
    if (pickGridScrollRef.current.listScrollTouched) return;
    const root = document.querySelector(
      ".bible-yv-pick-grid.is-books",
    ) as HTMLElement | null;
    const cell = document.getElementById(`bible-pick-book-${bookId}`);
    if (!root || !cell) return;
    const top =
      cell.offsetTop - Math.max(8, (root.clientHeight - cell.clientHeight) / 3);
    root.scrollTop = Math.max(
      0,
      Math.min(top, root.scrollHeight - root.clientHeight),
    );
  }, [pickerOpen, passageStep, bookId]);

  useEffect(() => {
    if (!pickerOpen || !pendingVerseStep.current) return;
    if (presentationInFlight) return;
    pendingVerseStep.current = false;
    if (passagePickerSkipsVerseStep()) {
      closePicker({ restoreFocus: false });
      return;
    }
    setPassageStep("verse");
  }, [pickerOpen, presentationInFlight, chapterId, passageId, closePicker]);

  return {
    discoverySplitSearch,
    pickerOpen,
    passageStep,
    setPassageStep,
    pickerBookId,
    setPickerBookId,
    passageRollOpen,
    bookSearchQuery,
    setBookSearchQuery,
    pickSearchOpen,
    setPickSearchOpen,
    togglePickSearch,
    closePickSearch,
    wordSearchOpen,
    wordSearchQuery,
    setWordSearchQuery,
    wordSearchScopeFilter,
    setWordSearchScopeFilter,
    wordSearchSelectedBookIds,
    setWordSearchSelectedBookIds,
    wordSearchFacets,
    wordSearchScopeCounts,
    discoverySession,
    passageDiscovery,
    passageDiscoveryBusy,
    wordDiscovery,
    wordDiscoveryBusy,
    wordVerseHits,
    wordVerseTotal,
    wordSearchPage,
    wordSearchPageCount,
    setWordSearchPage,
    wordSearchPaging,
    wordMatchMode,
    wordMatchedTerms,
    passageRollRef,
    wordSearchChromeRef,
    wordSearchPanelId,
    passagePickerPanelId,
    pendingVerseStep,
    armPendingVerseStep,
    patchDiscoverySession,
    setPickGridScroll,
    getPickGridScroll,
    setDiscoveryExpandedBook,
    setDiscoveryVerseListScroll,
    clearBookSearch,
    clearWordSearch,
    closeWordSearch,
    closePicker,
    closeAll,
    openPassagePicker,
    togglePassagePicker,
    togglePassagePickerRef,
    toggleWordSearch,
  };
}
