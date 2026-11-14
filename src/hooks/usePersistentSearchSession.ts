import { useCallback, useEffect, useRef, useState } from "react";
import type { BibleTextVersionId } from "../bible/bibleVersions";

/**
 * Escopo das pills.
 * - `current_book`: livro aberto no leitor (dinâmico; default).
 * - `books`: seleção explícita multi-livros (ids na sessão).
 * - `nt` / `ot` / `dc`: testamento / deuterocanônicos.
 * - `all`: Bíblia inteira (sem filtro de livro).
 */
export type SearchScopeFilter =
  | "all"
  | "books"
  | "nt"
  | "ot"
  | "dc"
  | "current_book";

/** @deprecated Preferir SearchScopeFilter */
export type SearchTestamentFilter = SearchScopeFilter;

export type SearchSessionState = {
  query: string;
  scopeFilter: SearchScopeFilter;
  selectedBookIds: string[];
  /** Página 1-based da lista de hits. */
  page: number;
  versionId?: BibleTextVersionId;
};

export const SEARCH_SESSION_STORAGE_KEY = "biblos_search_session_v1";

export const EMPTY_SEARCH_SESSION: SearchSessionState = {
  query: "",
  /** Default de negócio: filtrar pelo livro aberto no leitor. */
  scopeFilter: "current_book",
  selectedBookIds: [],
  page: 1,
};

function normalizePage(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function sessionKeyForVersion(versionId?: BibleTextVersionId): string {
  return versionId
    ? `${SEARCH_SESSION_STORAGE_KEY}:${versionId}`
    : SEARCH_SESSION_STORAGE_KEY;
}

function isScopeFilter(value: unknown): value is SearchScopeFilter {
  return (
    value === "all" ||
    value === "books" ||
    value === "nt" ||
    value === "ot" ||
    value === "dc" ||
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

export function readSearchSession(
  versionId?: BibleTextVersionId,
): SearchSessionState {
  try {
    const key = sessionKeyForVersion(versionId);
    let raw = sessionStorage.getItem(key);
    // Migração: sessão legada sem versionId
    if (!raw && versionId) {
      raw = sessionStorage.getItem(SEARCH_SESSION_STORAGE_KEY);
    }
    if (!raw) return { ...EMPTY_SEARCH_SESSION, versionId };
    const parsed = JSON.parse(raw) as Partial<SearchSessionState> & {
      testamentFilter?: unknown;
      scrollTop?: unknown;
    };
    const storedVersion = parsed.versionId;
    if (
      versionId &&
      storedVersion &&
      storedVersion !== versionId &&
      key === sessionKeyForVersion(versionId)
    ) {
      // Chave já é por versão — ignorar mismatch
    }
    const legacy = parsed.scopeFilter ?? parsed.testamentFilter;
    let scopeFilter: SearchScopeFilter = isScopeFilter(legacy)
      ? legacy
      : "current_book";
    let selectedBookIds = normalizeBookIds(parsed.selectedBookIds);

    // `current_book` é dinâmico (segue o leitor) — nunca congela bookIds.
    if (scopeFilter === "current_book") {
      selectedBookIds = [];
    }
    if (scopeFilter === "books" && selectedBookIds.length === 0) {
      scopeFilter = "current_book";
    }
    if (scopeFilter === "dc" && versionId === "s21") {
      scopeFilter = "current_book";
    }
    if (scopeFilter !== "books") {
      selectedBookIds = [];
    }

    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      scopeFilter,
      selectedBookIds,
      page: normalizePage(parsed.page),
      versionId,
    };
  } catch {
    return { ...EMPTY_SEARCH_SESSION, versionId };
  }
}

export function writeSearchSession(state: SearchSessionState): void {
  try {
    const key = sessionKeyForVersion(state.versionId);
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Persiste query / escopo / livros selecionados da busca de palavras.
 * Isolado por `versionId` — troca de versão reseta o estado visível.
 */
export function usePersistentSearchSession(versionId: BibleTextVersionId) {
  const [state, setState] = useState<SearchSessionState>(() =>
    readSearchSession(versionId),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const versionRef = useRef(versionId);
  versionRef.current = versionId;

  useEffect(() => {
    const next = readSearchSession(versionId);
    stateRef.current = next;
    setState(next);
  }, [versionId]);

  const persist = useCallback((next: SearchSessionState) => {
    const withVersion = { ...next, versionId: versionRef.current };
    stateRef.current = withVersion;
    setState(withVersion);
    writeSearchSession(withVersion);
  }, []);

  const setQuery = useCallback(
    (query: string) => {
      const prev = stateRef.current;
      if (query === prev.query) return;
      persist({ ...prev, query, page: 1 });
    },
    [persist],
  );

  const setScopeFilter = useCallback(
    (scopeFilter: SearchScopeFilter) => {
      const prev = stateRef.current;

      if (scopeFilter === "current_book") {
        if (
          prev.scopeFilter === "current_book" &&
          prev.selectedBookIds.length === 0
        ) {
          return;
        }
        persist({
          ...prev,
          scopeFilter: "current_book",
          selectedBookIds: [],
          page: 1,
        });
        return;
      }

      if (scopeFilter === "nt" || scopeFilter === "ot" || scopeFilter === "dc") {
        if (prev.scopeFilter === scopeFilter) return;
        persist({
          ...prev,
          scopeFilter,
          selectedBookIds: [],
          page: 1,
        });
        return;
      }

      if (scopeFilter === "all") {
        if (
          prev.scopeFilter === "all" &&
          prev.selectedBookIds.length === 0
        ) {
          return;
        }
        persist({
          ...prev,
          scopeFilter: "all",
          selectedBookIds: [],
          page: 1,
        });
        return;
      }

      // "books" sem ids — volta ao livro atual (default de negócio)
      if (prev.selectedBookIds.length === 0) {
        if (prev.scopeFilter === "current_book") return;
        persist({
          ...prev,
          scopeFilter: "current_book",
          selectedBookIds: [],
          page: 1,
        });
        return;
      }
      if (prev.scopeFilter === "books") return;
      persist({
        ...prev,
        scopeFilter: "books",
        selectedBookIds: prev.selectedBookIds,
        page: 1,
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
          scopeFilter: "current_book",
          selectedBookIds: [],
          page: 1,
        });
        return;
      }
      persist({
        ...prev,
        scopeFilter: "books",
        selectedBookIds: nextIds,
        page: 1,
      });
    },
    [persist],
  );

  const setPage = useCallback(
    (page: number) => {
      const prev = stateRef.current;
      const next = normalizePage(page);
      if (next === prev.page) return;
      persist({ ...prev, page: next });
    },
    [persist],
  );

  const setTestamentFilter = setScopeFilter;

  const clearSearch = useCallback(() => {
    persist({
      query: "",
      scopeFilter: stateRef.current.scopeFilter,
      selectedBookIds: stateRef.current.selectedBookIds,
      page: 1,
      versionId: versionRef.current,
    });
  }, [persist]);

  const resetForVersion = useCallback(() => {
    persist({
      ...EMPTY_SEARCH_SESSION,
      versionId: versionRef.current,
    });
  }, [persist]);

  return {
    state,
    query: state.query,
    scopeFilter: state.scopeFilter,
    selectedBookIds: state.selectedBookIds,
    page: state.page,
    testamentFilter: state.scopeFilter,
    setQuery,
    setScopeFilter,
    setSelectedBookIds,
    setPage,
    setTestamentFilter,
    clearSearch,
    resetForVersion,
  };
}
