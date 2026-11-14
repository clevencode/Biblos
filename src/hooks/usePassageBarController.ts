import {
  useCallback,
  useEffect,
  useId,
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
  const [bookSearchQuery, setBookSearchQuery] = useState("");
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

  const discoveryListScrollRaf = useRef(0);
  const discoveryVerseScrollRaf = useRef<Record<string, number>>({});
  const pendingVerseStep = useRef(false);
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

  const setDiscoveryListScroll = useCallback(
    (scrollTop: number) => {
      if (discoveryListScrollRaf.current) {
        cancelAnimationFrame(discoveryListScrollRaf.current);
      }
      discoveryListScrollRaf.current = requestAnimationFrame(() => {
        patchDiscoverySession({ listScrollTop: scrollTop });
      });
    },
    [patchDiscoverySession],
  );

  const setDiscoveryVerseListScroll = useCallback(
    (nextBookId: string, scrollTop: number) => {
      const id = String(nextBookId || "").toUpperCase();
      if (!id) return;
      const prevRaf = discoveryVerseScrollRaf.current[id];
      if (prevRaf) cancelAnimationFrame(prevRaf);
      discoveryVerseScrollRaf.current[id] = requestAnimationFrame(() => {
        setDiscoverySession((prev) => ({
          ...prev,
          verseScrollByBook: { ...prev.verseScrollByBook, [id]: scrollTop },
        }));
      });
    },
    [],
  );

  const clearBookSearch = useCallback(() => {
    setBookSearchQuery("");
    setDiscoverySession({ ...EMPTY_PASSAGE_DISCOVERY_SESSION });
  }, []);

  const clearWordSearch = useCallback(() => {
    clearWordSearchSession();
  }, [clearWordSearchSession]);

  const closeWordSearch = useCallback(() => {
    requestCloseWordSearch();
  }, [requestCloseWordSearch]);

  const closePicker = useCallback(() => {
    setPassageStep("book");
    pendingVerseStep.current = false;
    requestClosePicker();
  }, [requestClosePicker]);

  const closeAll = useCallback(() => {
    closePicker();
    closeWordSearch();
  }, [closePicker, closeWordSearch]);

  const openPassagePicker = useCallback(
    (step: "book" | "chapter") => {
      if (!pickerPanelOpenAllowed) return;
      setPassageStep(step);
      pendingVerseStep.current = false;
      requestOpenPassagePicker();
    },
    [pickerPanelOpenAllowed, requestOpenPassagePicker],
  );

  const togglePassagePicker = useCallback(
    (step: "book" | "chapter") => {
      if (!pickerPanelOpenAllowed) return;
      if (passageRollOpen && passageStep === step) {
        closePicker();
        return;
      }
      openPassagePicker(step);
    },
    [pickerPanelOpenAllowed, passageRollOpen, passageStep, closePicker, openPassagePicker],
  );

  const togglePassagePickerRef = useCallback(() => {
    if (!pickerPanelOpenAllowed) return;
    const rollRelevant = passageStep === "book" || passageStep === "chapter";
    if (passageRollOpen && rollRelevant) {
      closePicker();
      return;
    }
    const step: "book" | "chapter" =
      passageStep === "chapter" ? "chapter" : "book";
    openPassagePicker(step);
  }, [
    pickerPanelOpenAllowed,
    passageStep,
    passageRollOpen,
    closePicker,
    openPassagePicker,
  ]);

  const toggleWordSearch = useCallback(() => {
    if (!wordSearchOpen) {
      setPassageStep("book");
      pendingVerseStep.current = false;
    }
    requestToggleWordSearch();
  }, [wordSearchOpen, requestToggleWordSearch]);

  const armPendingVerseStep = useCallback((armed: boolean) => {
    pendingVerseStep.current = armed;
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const id = window.setTimeout(() => {
      if (passageStep === "book") {
        const input = passageRollRef.current?.querySelector(
          ".bible-yv-pick-search",
        ) as HTMLInputElement | null;
        input?.focus();
        return;
      }
      const chip = passageRollRef.current?.querySelector(
        ".bible-yv-passage-chip.is-chapter, .bible-yv-passage-chip.is-ref",
      ) as HTMLButtonElement | null;
      chip?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [pickerOpen, passageStep]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!(target instanceof Element)) return;
      if (target.closest(".bible-yv-dock")) return;
      if (target.closest(".bible-yv-passage-roll-scrim")) return;
      /* Painel / cluster / roll — não fechar ao digitar ou fazer scroll */
      if (
        target.closest(".bible-yv-passage-scroll-panel") ||
        target.closest(".bible-yv-passage-chrome-cluster") ||
        target.closest(".bible-yv-passage-roll") ||
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
      closePicker();
      return;
    }
    setPassageStep("verse");
  }, [pickerOpen, presentationInFlight, chapterId, passageId, closePicker]);

  useEffect(() => {
    return () => {
      if (discoveryListScrollRaf.current) {
        cancelAnimationFrame(discoveryListScrollRaf.current);
      }
      for (const id of Object.keys(discoveryVerseScrollRaf.current)) {
        const raf = discoveryVerseScrollRaf.current[id];
        if (raf) cancelAnimationFrame(raf);
      }
    };
  }, []);

  return {
    discoverySplitSearch,
    pickerOpen,
    passageStep,
    setPassageStep,
    passageRollOpen,
    bookSearchQuery,
    setBookSearchQuery,
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
    setDiscoveryListScroll,
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
