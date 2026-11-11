import { useCallback, useRef, useState } from "react";

/** Escopo das pills. `books` = seleção multi-livros. */
export type SearchScopeFilter = "all" | "books" | "nt" | "ot" | "current_book";

/** @deprecated Preferir SearchScopeFilter */
export type SearchTestamentFilter = SearchScopeFilter;

export type SearchSessionState = {
  query: string;
  scopeFilter: SearchScopeFilter;
  selectedBookIds: string[];
};

export const SEARCH_SESSION_STORAGE_KEY = "biblos_search_session_v1";

export const EMPTY_SEARCH_SESSION: SearchSessionState = {
  query: "",
  scopeFilter: "all",
  selectedBookIds: [],
};

function isScopeFilter(value: unknown): value is SearchScopeFilter {
  return (
    value === "all" ||
    value === "books" ||
    value === "nt" ||
    value === "ot" ||
    value === "current_book"
  );
}

function normalizeBookIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const id = String(item || "")
      .trim()
      .toUpperCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function readSearchSession(): SearchSessionState {
  try {
    const raw = sessionStorage.getItem(SEARCH_SESSION_STORAGE_KEY);
    if (!raw) return { ...EMPTY_SEARCH_SESSION };
    const parsed = JSON.parse(raw) as Partial<SearchSessionState> & {
      testamentFilter?: unknown;
      scrollTop?: unknown;
    };
    const legacy = parsed.scopeFilter ?? parsed.testamentFilter;
    let scopeFilter: SearchScopeFilter = isScopeFilter(legacy) ? legacy : "all";
    let selectedBookIds = normalizeBookIds(parsed.selectedBookIds);

    // current_book legado: se já há bookIds, vira books; senão mantém até hydrate no controller
    if (scopeFilter === "current_book" && selectedBookIds.length > 0) {
      scopeFilter = "books";
    }
    if (scopeFilter === "books" && selectedBookIds.length === 0) {
      scopeFilter = "all";
    }
    if (scopeFilter !== "books" && scopeFilter !== "current_book") {
      selectedBookIds = [];
    }

    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      scopeFilter,
      selectedBookIds,
    };
  } catch {
    return { ...EMPTY_SEARCH_SESSION };
  }
}

export function writeSearchSession(state: SearchSessionState): void {
  try {
    sessionStorage.setItem(SEARCH_SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Persiste query / escopo / livros selecionados da busca de palavras.
 */
export function usePersistentSearchSession() {
  const [state, setState] = useState<SearchSessionState>(() => readSearchSession());
  const stateRef = useRef(state);
  stateRef.current = state;

  const persist = useCallback((next: SearchSessionState) => {
    stateRef.current = next;
    setState(next);
    writeSearchSession(next);
  }, []);

  const setQuery = useCallback(
    (query: string) => {
      const prev = stateRef.current;
      if (query === prev.query) return;
      persist({ ...prev, query });
    },
    [persist],
  );

  const setScopeFilter = useCallback(
    (scopeFilter: SearchScopeFilter) => {
      const prev = stateRef.current;
      const nextFilter =
        scopeFilter === "current_book" ? "books" : scopeFilter;
      if (nextFilter === "all" || nextFilter === "nt" || nextFilter === "ot") {
        if (
          prev.scopeFilter === nextFilter &&
          prev.selectedBookIds.length === 0
        ) {
          return;
        }
        persist({
          ...prev,
          scopeFilter: nextFilter,
          selectedBookIds: [],
        });
        return;
      }
      if (prev.scopeFilter === "books") return;
      persist({
        ...prev,
        scopeFilter: "books",
        selectedBookIds: prev.selectedBookIds,
      });
    },
    [persist],
  );

  const setSelectedBookIds = useCallback(
    (bookIds: string[]) => {
      const nextIds = normalizeBookIds(bookIds);
      const prev = stateRef.current;
      if (
        prev.scopeFilter === "books" &&
        prev.selectedBookIds.length === nextIds.length &&
        prev.selectedBookIds.every((id, i) => id === nextIds[i])
      ) {
        return;
      }
      if (nextIds.length === 0) {
        persist({
          ...prev,
          scopeFilter: "all",
          selectedBookIds: [],
        });
        return;
      }
      persist({
        ...prev,
        scopeFilter: "books",
        selectedBookIds: nextIds,
      });
    },
    [persist],
  );

  const setTestamentFilter = setScopeFilter;

  const clearSearch = useCallback(() => {
    persist({
      query: "",
      scopeFilter: stateRef.current.scopeFilter,
      selectedBookIds: stateRef.current.selectedBookIds,
    });
  }, [persist]);

  return {
    state,
    query: state.query,
    scopeFilter: state.scopeFilter,
    selectedBookIds: state.selectedBookIds,
    testamentFilter: state.scopeFilter,
    setQuery,
    setScopeFilter,
    setSelectedBookIds,
    setTestamentFilter,
    clearSearch,
  };
}
