import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { normalizeSearchText } from "../bible/verseSearchEngine";

export type PersistedScrollData = {
  signature: string;
  scrollTop: number;
  loadedLimit: number;
};

export const SESSION_SCROLL_KEY = "biblos_word_search_scroll_v1";

const EMPTY_SCROLL: PersistedScrollData = {
  signature: "",
  scrollTop: 0,
  loadedLimit: 0,
};

/** Fallback em memória se sessionStorage estiver indisponível. */
let memoryFallback: PersistedScrollData = { ...EMPTY_SCROLL };

export function buildSearchSignature(input: {
  versionId: string;
  query: string;
  filter?: string;
  loadedLimit: number;
}): string {
  const versionId = String(input.versionId || "s21");
  const query = normalizeSearchText(input.query);
  const filter = String(input.filter || "all");
  const loadedLimit = Math.max(0, Number(input.loadedLimit) || 0);
  return `${versionId}::${query}::${filter}::${loadedLimit}`;
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
      loadedLimit:
        typeof parsed.loadedLimit === "number" && Number.isFinite(parsed.loadedLimit)
          ? Math.max(0, parsed.loadedLimit)
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
    loadedLimit: Math.max(0, data.loadedLimit),
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
  loadedLimit: number;
  /** Só restaurar quando a lista estiver pronta (não em loading). */
  resultsReady?: boolean;
}) {
  const {
    isOpen,
    searchSignature,
    resultsCount,
    loadedLimit,
    resultsReady = resultsCount > 0,
  } = params;

  const listRef = useRef<HTMLDivElement | null>(null);
  const currentScrollRef = useRef(0);
  const signatureRef = useRef(searchSignature);
  const loadedLimitRef = useRef(loadedLimit);
  signatureRef.current = searchSignature;
  loadedLimitRef.current = loadedLimit;

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
      loadedLimit: loadedLimitRef.current,
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
    if (saved.signature === searchSignature && saved.scrollTop > 0) {
      el.scrollTop = saved.scrollTop;
      currentScrollRef.current = saved.scrollTop;
    } else {
      el.scrollTop = 0;
      currentScrollRef.current = 0;
    }
  }, [isOpen, searchSignature, resultsCount, resultsReady]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      writeScrollData({
        signature: signatureRef.current,
        scrollTop: currentScrollRef.current,
        loadedLimit: loadedLimitRef.current,
      });
    };
  }, [isOpen]);

  return { listRef, handleScroll, flushScroll, resetScroll };
}
