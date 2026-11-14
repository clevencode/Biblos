import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { normalizeSearchText } from "../bible/verseSearchEngine";

/**
 * Histórico de scroll da busca de palavras (sessão).
 *
 * Regras de negócio:
 * - Posição = vista (assinatura da busca + página) → scrollTop
 * - Restaurar só uma vez por ciclo de vista (sem lutar com o scroll do utilizador)
 * - onScroll: só ref em memória (sem setState / sem storage)
 * - Persistência: fechar, desmontar, flush (pick), troca de vista, ou reset
 */

const MAX_VIEWS = 12;

export type PersistedScrollData = {
  /** chave = `${signature}::p${page}` → scrollTop */
  byView: Record<string, number>;
  /** Ordem LRU das chaves (mais recente no fim). */
  order: string[];
};

/** @deprecated formato v1 — migrado em readScrollData */
type LegacyScrollData = {
  signature?: string;
  page?: number;
  scrollTop?: number;
};

export const SESSION_SCROLL_KEY = "biblos_word_search_scroll_v1";

/** Fallback em memória se sessionStorage estiver indisponível. */
let memoryFallback: PersistedScrollData = {
  byView: {},
  order: [],
};

function storageKeyForVersion(versionId?: string): string {
  const id = String(versionId || "").trim();
  return id ? `${SESSION_SCROLL_KEY}:${id}` : SESSION_SCROLL_KEY;
}

function normalizePage(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function viewScrollKey(signature: string, page: number): string {
  return `${signature}::p${normalizePage(page)}`;
}

/** Assinatura da busca (sem página — página vai na chave da vista). */
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

function pruneStore(store: PersistedScrollData): PersistedScrollData {
  if (store.order.length <= MAX_VIEWS) return store;
  const keep = store.order.slice(-MAX_VIEWS);
  const byView: Record<string, number> = {};
  for (const key of keep) {
    const value = store.byView[key];
    if (typeof value === "number") byView[key] = value;
  }
  return { byView, order: keep };
}

function putScroll(
  store: PersistedScrollData,
  key: string,
  scrollTop: number,
): PersistedScrollData {
  const top = Math.max(0, scrollTop);
  const order = store.order.filter((k) => k !== key);
  order.push(key);
  return pruneStore({
    byView: { ...store.byView, [key]: top },
    order,
  });
}

function parseStore(raw: string): PersistedScrollData {
  const parsed = JSON.parse(raw) as Partial<PersistedScrollData> &
    LegacyScrollData;
  if (parsed && parsed.byView && typeof parsed.byView === "object") {
    const byView: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed.byView)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        byView[key] = Math.max(0, value);
      }
    }
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((k): k is string => typeof k === "string" && k in byView)
      : Object.keys(byView);
    return pruneStore({ byView, order });
  }
  // Legado: { signature, page, scrollTop }
  if (typeof parsed?.signature === "string" && parsed.signature) {
    const key = viewScrollKey(parsed.signature, normalizePage(parsed.page));
    const scrollTop =
      typeof parsed.scrollTop === "number" && Number.isFinite(parsed.scrollTop)
        ? Math.max(0, parsed.scrollTop)
        : 0;
    return putScroll({ byView: {}, order: [] }, key, scrollTop);
  }
  return { byView: {}, order: [] };
}

export function readScrollData(versionId?: string): PersistedScrollData {
  const key = storageKeyForVersion(versionId);
  try {
    let raw = sessionStorage.getItem(key);
    if (!raw && versionId) {
      raw = sessionStorage.getItem(SESSION_SCROLL_KEY);
    }
    if (!raw) {
      return memoryFallback.order.length
        ? {
            byView: { ...memoryFallback.byView },
            order: [...memoryFallback.order],
          }
        : { byView: {}, order: [] };
    }
    return parseStore(raw);
  } catch {
    return memoryFallback.order.length
      ? {
          byView: { ...memoryFallback.byView },
          order: [...memoryFallback.order],
        }
      : { byView: {}, order: [] };
  }
}

export function writeScrollData(
  data: PersistedScrollData,
  versionId?: string,
): void {
  memoryFallback = {
    byView: { ...data.byView },
    order: [...data.order],
  };
  try {
    sessionStorage.setItem(
      storageKeyForVersion(versionId),
      JSON.stringify(memoryFallback),
    );
  } catch {
    /* private mode / quota */
  }
}

function persistViewScroll(
  signature: string,
  page: number,
  scrollTop: number,
  versionId?: string,
): void {
  const store = readScrollData(versionId);
  writeScrollData(
    putScroll(store, viewScrollKey(signature, page), scrollTop),
    versionId,
  );
}

export function useSearchScrollRestoration(params: {
  isOpen: boolean;
  searchSignature: string;
  resultsCount: number;
  /** Página 1-based — faz parte da identidade da vista. */
  page?: number;
  /** Isola o histórico por versão bíblica. */
  versionId?: string;
  /** Só restaurar quando a lista estiver pronta (não em loading). */
  resultsReady?: boolean;
}) {
  const {
    isOpen,
    searchSignature,
    resultsCount,
    page = 1,
    versionId,
    resultsReady = resultsCount > 0,
  } = params;

  const listRef = useRef<HTMLDivElement | null>(null);
  const currentScrollRef = useRef(0);
  const signatureRef = useRef(searchSignature);
  const pageRef = useRef(page);
  const versionRef = useRef(versionId);
  const restoredForRef = useRef("");
  const activeViewRef = useRef<{
    key: string;
    signature: string;
    page: number;
  } | null>(null);

  signatureRef.current = searchSignature;
  pageRef.current = page;
  versionRef.current = versionId;

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
    persistViewScroll(
      signatureRef.current,
      pageRef.current,
      currentScrollRef.current,
      versionRef.current,
    );
  }, []);

  const resetScroll = useCallback(() => {
    currentScrollRef.current = 0;
    restoredForRef.current = "";
    activeViewRef.current = null;
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
    memoryFallback = { byView: {}, order: [] };
    try {
      sessionStorage.removeItem(storageKeyForVersion(versionRef.current));
    } catch {
      /* private mode */
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      restoredForRef.current = "";
      activeViewRef.current = null;
      return;
    }
    if (!resultsReady || resultsCount <= 0) return;
    const el = listRef.current;
    if (!el) return;

    const safePage = normalizePage(page);
    const viewKey = viewScrollKey(searchSignature, safePage);
    const prev = activeViewRef.current;

    if (prev && prev.key !== viewKey) {
      persistViewScroll(
        prev.signature,
        prev.page,
        currentScrollRef.current,
        versionId,
      );
    }

    if (restoredForRef.current === viewKey) return;
    restoredForRef.current = viewKey;
    activeViewRef.current = {
      key: viewKey,
      signature: searchSignature,
      page: safePage,
    };

    const saved = readScrollData(versionId).byView[viewKey] ?? 0;
    if (saved > 0) {
      el.scrollTop = saved;
      currentScrollRef.current = saved;
      return;
    }

    el.scrollTop = 0;
    currentScrollRef.current = 0;
  }, [isOpen, searchSignature, resultsCount, resultsReady, page, versionId]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      persistViewScroll(
        signatureRef.current,
        pageRef.current,
        currentScrollRef.current,
        versionRef.current,
      );
    };
  }, [isOpen]);

  return { listRef, handleScroll, flushScroll, resetScroll };
}
