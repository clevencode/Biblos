import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { normalizeSearchText } from "../bible/verseSearchEngine";

export type PersistedScrollData = {
  signature: string;
  scrollTop: number;
};

export const SESSION_SCROLL_KEY = "biblos_word_search_scroll_v1";

const EMPTY_SCROLL: PersistedScrollData = {
  signature: "",
  scrollTop: 0,
};

/** Fallback em memória se sessionStorage estiver indisponível. */
let memoryFallback: PersistedScrollData = { ...EMPTY_SCROLL };

/** Assinatura da busca (sem página — paginação reseta scroll à parte). */
export function buildSearchSignature(input: {
  versionId: string;
  query: string;
  filter?: string;
}): string {
  const versionId = String(input.versionId || "s21");
  const query = normalizeSearchText(input.query);
  const filter = String(input.filter || "all");
  return `${versionId}::${query}::${filter}`;
}

export function readScrollData(): PersistedScrollData {
  try {
    const raw = sessionStorage.getItem(SESSION_SCROLL_KEY);
    if (!raw) return { ...memoryFallback };
    const parsed = JSON.parse(raw) as Partial<PersistedScrollData>;
    return {
      signature: typeof parsed.signature === "string" ? parsed.signature : "",
      scrollTop:
        typeof parsed.scrollTop === "number" && Number.isFinite(parsed.scrollTop)
          ? Math.max(0, parsed.scrollTop)
          : 0,
    };
  } catch {
    return { ...memoryFallback };
  }
}

export function writeScrollData(data: PersistedScrollData): void {
  memoryFallback = {
    signature: data.signature,
    scrollTop: Math.max(0, data.scrollTop),
  };
  try {
    sessionStorage.setItem(SESSION_SCROLL_KEY, JSON.stringify(memoryFallback));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Restauração de scroll da busca de palavras:
 * - onScroll: só ref em memória (zero setState / zero storage)
 * - persist: ao fechar, desmontar, flush explícito (pick) ou reset
 */
export function useSearchScrollRestoration(params: {
  isOpen: boolean;
  searchSignature: string;
  resultsCount: number;
  /** Página atual — mudança força scrollTop 0 sem alterar a assinatura. */
  page?: number;
  /** Só restaurar quando a lista estiver pronta (não em loading). */
  resultsReady?: boolean;
}) {
  const {
    isOpen,
    searchSignature,
    resultsCount,
    page = 1,
    resultsReady = resultsCount > 0,
  } = params;

  const listRef = useRef<HTMLDivElement | null>(null);
  const currentScrollRef = useRef(0);
  const signatureRef = useRef(searchSignature);
  const pageRef = useRef(page);
  signatureRef.current = searchSignature;
  pageRef.current = page;

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (el) {
      currentScrollRef.current = el.scrollTop;
    }
  }, []);

  const flushScroll = useCallback(() => {
    const el = listRef.current;
    if (el) {
      currentScrollRef.current = el.scrollTop;
    }
    writeScrollData({
      signature: signatureRef.current,
      scrollTop: currentScrollRef.current,
    });
  }, []);

  const resetScroll = useCallback(() => {
    currentScrollRef.current = 0;
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
    writeScrollData({ ...EMPTY_SCROLL });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !resultsReady || resultsCount <= 0) return;
    const el = listRef.current;
    if (!el) return;

    const saved = readScrollData();
    if (saved.signature === searchSignature && page === 1 && saved.scrollTop > 0) {
      el.scrollTop = saved.scrollTop;
      currentScrollRef.current = saved.scrollTop;
    } else {
      el.scrollTop = 0;
      currentScrollRef.current = 0;
    }
  }, [isOpen, searchSignature, resultsCount, resultsReady, page]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      writeScrollData({
        signature: signatureRef.current,
        scrollTop: pageRef.current === 1 ? currentScrollRef.current : 0,
      });
    };
  }, [isOpen]);

  return { listRef, handleScroll, flushScroll, resetScroll };
}
