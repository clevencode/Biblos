import { useEffect, useMemo, useRef, useState } from "react";
import { searchVersesForVersion } from "../bible/passageForVersion";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import {
  emptySearchFacets,
  type MatchMode,
  type SearchFacets,
  type SearchScope,
} from "../bible/verseSearchEngine";
import type { SearchScopeFilter } from "./usePersistentSearchSession";
import type { BibleSearchHit } from "../youversion/client";
import { passageJumpsFromQuery } from "../youversion/bibleRefs";

/**
 * Pesquisa por palavras — uma busca, facets + filtro de escopo em memória.
 */
const DEBOUNCE_MS = 280;
const MIN_CHARS = 2;
const HIT_LIMIT = 40;

export type WordSearchScopeCounts = {
  all: number;
  books: number;
  nt: number;
  ot: number;
  /** Contagem do livro atual (pill). */
  current_book: number;
};

export type WordPassageSearchOptions = {
  scopeFilter?: SearchScopeFilter;
  selectedBookIds?: string[];
  currentBookId?: string | null;
};

export function buildEngineScope(
  scopeFilter: SearchScopeFilter,
  selectedBookIds: string[],
  currentBookId?: string | null,
): SearchScope {
  if (scopeFilter === "nt") return { type: "nt" };
  if (scopeFilter === "ot") return { type: "ot" };
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
    current_book: current ? facets.byBook[current] ?? 0 : 0,
  };
}

const EMPTY_COUNTS: WordSearchScopeCounts = {
  all: 0,
  books: 0,
  nt: 0,
  ot: 0,
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
  busy: boolean;
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

  const engineScope = useMemo(
    () => buildEngineScope(scopeFilter, selectedBookIds, currentBookId),
    [scopeFilter, selectedBookIds, currentBookId],
  );

  const [hits, setHits] = useState<BibleSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<MatchMode | null>(null);
  const [matchedTerms, setMatchedTerms] = useState<string[]>([]);
  const [facets, setFacets] = useState<SearchFacets>(() => emptySearchFacets());
  const [scopeCounts, setScopeCounts] = useState<WordSearchScopeCounts>(EMPTY_COUNTS);
  const reqGen = useRef(0);

  const scopeKey = useMemo(() => {
    if (engineScope.type === "books") {
      return `books:${[...engineScope.bookIds].sort().join(",")}`;
    }
    return engineScope.type;
  }, [engineScope]);

  useEffect(() => {
    if (!enabled) return;

    const q = query.trim();
    if (q.length < MIN_CHARS || passageJumpsFromQuery(q).length > 0) {
      reqGen.current += 1;
      setHits([]);
      setTotal(0);
      setError(null);
      setBusy(false);
      setMatchMode(null);
      setMatchedTerms([]);
      setFacets(emptySearchFacets());
      setScopeCounts(EMPTY_COUNTS);
      return;
    }

    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await searchVersesForVersion(textVersion, q, HIT_LIMIT, {
          scope: engineScope,
        });
        if (gen !== reqGen.current) return;

        if (!res.ok) {
          setError(res.error || "Recherche indisponible");
          setHits([]);
          setTotal(0);
          setMatchMode(null);
          setMatchedTerms([]);
          setFacets(emptySearchFacets());
          setScopeCounts(EMPTY_COUNTS);
          setBusy(false);
          return;
        }

        const nextFacets =
          res.facets ??
          ({
            total: res.total ?? 0,
            otCount: 0,
            ntCount: 0,
            byBook: res.bookCounts ?? {},
          } satisfies SearchFacets);

        // Se API remota não preencheu ot/nt, derivar de byBook no cliente fica parcial;
        // offline sempre envia facets completos.
        setFacets(nextFacets);
        setScopeCounts(
          buildScopeCounts(nextFacets, currentBookId, selectedBookIds),
        );
        setHits(res.results ?? []);
        setTotal(res.total ?? res.results?.length ?? 0);
        setMatchMode(res.matchMode ?? null);
        setMatchedTerms(res.matchedTerms ?? []);
        setError(null);
        setBusy(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    query,
    enabled,
    textVersion,
    scopeKey,
    engineScope,
    currentBookId,
    selectedBookIds,
  ]);

  return {
    hits,
    total,
    busy,
    error,
    matchMode,
    matchedTerms,
    bookCounts: facets.byBook,
    facets,
    scopeCounts,
  };
}
