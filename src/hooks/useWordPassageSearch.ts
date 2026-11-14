import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import {
  bookIdsForSearchScope,
  emptySearchFacets,
  facetsFromBookCounts,
  type MatchMode,
  type SearchFacets,
  type SearchScope,
} from "../bible/verseSearchEngine";
import { searchInWorker } from "../bible/verseSearchClient";
import type { SearchScopeFilter } from "./usePersistentSearchSession";
import type { BibleSearchHit } from "../youversion/client";
import { passageJumpsFromQuery } from "../youversion/bibleRefs";

/**
 * Pesquisa por palavras — worker + facets pré-filtro, debounce 280ms, páginas de 40.
 */
const DEBOUNCE_MS = 280;
const MIN_CHARS = 2;
export const WORD_SEARCH_PAGE_SIZE = 40;

export type WordSearchScopeCounts = {
  all: number;
  books: number;
  nt: number;
  ot: number;
  dc: number;
  /** Contagem do livro atual (pill). */
  current_book: number;
};

export type WordPassageSearchOptions = {
  scopeFilter?: SearchScopeFilter;
  selectedBookIds?: string[];
  currentBookId?: string | null;
  /** Página 1-based controlada pela sessão (opcional). */
  page?: number;
  onPageChange?: (page: number) => void;
};

export function buildEngineScope(
  scopeFilter: SearchScopeFilter,
  selectedBookIds: string[],
  currentBookId?: string | null,
): SearchScope {
  if (scopeFilter === "nt") return { type: "nt" };
  if (scopeFilter === "ot") return { type: "ot" };
  if (scopeFilter === "dc") return { type: "dc" };
  if (scopeFilter === "books" || scopeFilter === "current_book") {
    const ids =
      selectedBookIds.length > 0
        ? selectedBookIds
        : currentBookId
          ? [String(currentBookId).toUpperCase()]
          : [];
    if (ids.length === 0) return { type: "all" };
    return { type: "books", bookIds: ids };
  }
  return { type: "all" };
}

function resolveFacets(res: {
  facets?: SearchFacets;
  bookCounts?: Record<string, number>;
  total?: number;
}): SearchFacets {
  if (res.facets) {
    return {
      ...res.facets,
      dcCount: res.facets.dcCount ?? 0,
    };
  }
  return facetsFromBookCounts(res.bookCounts, res.total ?? 0);
}

function buildScopeCounts(
  facets: SearchFacets,
  currentBookId: string | null | undefined,
  selectedBookIds: string[],
): WordSearchScopeCounts {
  const current = String(currentBookId || "")
    .trim()
    .toUpperCase();
  const booksSum =
    selectedBookIds.length > 0
      ? selectedBookIds.reduce(
          (sum, id) => sum + (facets.byBook[String(id).toUpperCase()] ?? 0),
          0,
        )
      : current
        ? facets.byBook[current] ?? 0
        : 0;
  return {
    all: facets.total,
    books: booksSum,
    nt: facets.ntCount,
    ot: facets.otCount,
    dc: facets.dcCount ?? 0,
    current_book: current ? facets.byBook[current] ?? 0 : 0,
  };
}

const EMPTY_COUNTS: WordSearchScopeCounts = {
  all: 0,
  books: 0,
  nt: 0,
  ot: 0,
  dc: 0,
  current_book: 0,
};

export function useWordPassageSearch(
  query: string,
  enabled: boolean,
  textVersion: BibleTextVersionId,
  options?: WordPassageSearchOptions,
): {
  hits: BibleSearchHit[];
  total: number;
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  busy: boolean;
  paging: boolean;
  error: string | null;
  matchMode: MatchMode | null;
  matchedTerms: string[];
  bookCounts: Record<string, number>;
  facets: SearchFacets;
  scopeCounts: WordSearchScopeCounts;
} {
  const scopeFilter = options?.scopeFilter ?? "all";
  const selectedBookIds = options?.selectedBookIds ?? [];
  const currentBookId = options?.currentBookId ?? null;
  const controlledPage = options?.page;
  const onPageChange = options?.onPageChange;

  const engineScope = useMemo(
    () => buildEngineScope(scopeFilter, selectedBookIds, currentBookId),
    [scopeFilter, selectedBookIds, currentBookId],
  );

  const scopeKey = useMemo(() => {
    if (engineScope.type === "books") {
      return `books:${[...engineScope.bookIds].sort().join(",")}`;
    }
    return engineScope.type;
  }, [engineScope]);

  const searchKey = `${textVersion}::${query.trim()}::${scopeKey}`;

  const [hits, setHits] = useState<BibleSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [internalPage, setInternalPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<MatchMode | null>(null);
  const [matchedTerms, setMatchedTerms] = useState<string[]>([]);
  const [facets, setFacets] = useState<SearchFacets>(() => emptySearchFacets());
  const [scopeCounts, setScopeCounts] = useState<WordSearchScopeCounts>(EMPTY_COUNTS);

  const reqGen = useRef(0);
  const committedSearchKeyRef = useRef(searchKey);
  const hitsLenRef = useRef(0);
  hitsLenRef.current = hits.length;

  const pageFromProps =
    controlledPage != null ? Math.max(1, Math.floor(controlledPage)) : null;
  const page = pageFromProps ?? internalPage;

  // UI page: if search identity changed since last committed fetch, show 1.
  const displayPage =
    committedSearchKeyRef.current !== searchKey ? 1 : page;

  const pageCount =
    total === 0 ? 0 : Math.max(1, Math.ceil(total / WORD_SEARCH_PAGE_SIZE));

  const setPage = useCallback(
    (next: number) => {
      const max = pageCount > 0 ? pageCount : 1;
      const clamped = Math.min(max, Math.max(1, Math.floor(next)));
      if (pageFromProps == null) {
        setInternalPage(clamped);
      }
      onPageChange?.(clamped);
    },
    [pageCount, pageFromProps, onPageChange],
  );

  useEffect(() => {
    if (!enabled) return;

    const q = query.trim();
    if (q.length < MIN_CHARS || passageJumpsFromQuery(q).length > 0) {
      reqGen.current += 1;
      committedSearchKeyRef.current = searchKey;
      setHits([]);
      setTotal(0);
      setError(null);
      setBusy(false);
      setPaging(false);
      setMatchMode(null);
      setMatchedTerms([]);
      setFacets(emptySearchFacets());
      setScopeCounts(EMPTY_COUNTS);
      return;
    }

    const keyChanged = committedSearchKeyRef.current !== searchKey;
    const effectivePage = keyChanged ? 1 : Math.max(1, page);
    const keepHits = !keyChanged && hitsLenRef.current > 0;

    if (keyChanged) {
      if (pageFromProps == null) {
        setInternalPage(1);
      } else if (page !== 1) {
        onPageChange?.(1);
      }
    }

    const gen = ++reqGen.current;
    if (keepHits) {
      setPaging(true);
      setBusy(false);
    } else {
      setBusy(true);
      setPaging(false);
    }
    setError(null);

    const delay = keyChanged ? DEBOUNCE_MS : 0;
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await searchInWorker({
          versionId: textVersion,
          q,
          limit: WORD_SEARCH_PAGE_SIZE,
          offset: (effectivePage - 1) * WORD_SEARCH_PAGE_SIZE,
          scope: engineScope,
        });
        if (gen !== reqGen.current) return;

        committedSearchKeyRef.current = searchKey;

        if (!res.ok) {
          setError(res.error || "unavailable");
          if (!keepHits) {
            setHits([]);
            setTotal(0);
            setMatchMode(null);
            setMatchedTerms([]);
            setFacets(emptySearchFacets());
            setScopeCounts(EMPTY_COUNTS);
          }
          setBusy(false);
          setPaging(false);
          return;
        }

        const nextFacets = resolveFacets(res);
        const nextTotal = res.total ?? res.results?.length ?? 0;
        setFacets(nextFacets);
        setScopeCounts(
          buildScopeCounts(nextFacets, currentBookId, selectedBookIds),
        );
        setHits(res.results ?? []);
        setTotal(nextTotal);
        setMatchMode(res.matchMode ?? null);
        setMatchedTerms(res.matchedTerms ?? []);
        setError(null);
        setBusy(false);
        setPaging(false);

        const maxPage = Math.max(
          1,
          Math.ceil(nextTotal / WORD_SEARCH_PAGE_SIZE) || 1,
        );
        if (effectivePage > maxPage) {
          if (pageFromProps == null) setInternalPage(maxPage);
          onPageChange?.(maxPage);
        }
      })();
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    query,
    enabled,
    textVersion,
    searchKey,
    engineScope,
    currentBookId,
    selectedBookIds,
    page,
    pageFromProps,
    onPageChange,
  ]);

  return {
    hits,
    total,
    page: displayPage,
    pageCount,
    setPage,
    busy,
    paging,
    error,
    matchMode,
    matchedTerms,
    bookCounts: facets.byBook,
    facets,
    scopeCounts,
  };
}

// Re-export para callers que ainda tipam books remotos
export { bookIdsForSearchScope };
