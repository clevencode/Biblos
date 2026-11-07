import { useCallback, useEffect, useState } from "react";
import {
  getSyncCatalog,
  hydrateCatalog,
  readBrowserOffline,
  resolveBookDisplay,
  type CatalogHydration,
  type CatalogSource,
} from "../bible/bibleCatalogRepository";
import type { YouVersionBible, YouVersionBook } from "../youversion/client";

export type UseBibleCatalogResult = {
  books: YouVersionBook[];
  bible: YouVersionBible;
  setBible: (b: YouVersionBible | null) => void;
  catalogSource: CatalogSource;
  isOffline: boolean;
  isNetworkRefresh: boolean;
  refreshCatalog: () => Promise<CatalogHydration>;
  resolveBookTitle: (bookId: string) => string;
};

export function useBibleCatalog(): UseBibleCatalogResult {
  const initial = getSyncCatalog();
  const [books, setBooks] = useState<YouVersionBook[]>(initial.books);
  const [bible, setBibleState] = useState<YouVersionBible>(initial.bible);
  const [catalogSource, setCatalogSource] = useState<CatalogSource>(initial.source);
  const [isOffline, setIsOffline] = useState(readBrowserOffline);
  const [isNetworkRefresh, setIsNetworkRefresh] = useState(false);

  const applyHydration = useCallback((h: CatalogHydration) => {
    setBooks(h.books);
    setBibleState(h.bible);
    setCatalogSource(h.source);
  }, []);

  const refreshCatalog = useCallback(async () => {
    setIsNetworkRefresh(true);
    try {
      const next = await hydrateCatalog();
      applyHydration(next);
      return next;
    } finally {
      setIsNetworkRefresh(false);
    }
  }, [applyHydration]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await hydrateCatalog();
      if (!cancelled) applyHydration(next);
    })();

    const onOnline = () => {
      setIsOffline(false);
      void refreshCatalog();
    };
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [applyHydration, refreshCatalog]);

  const setBible = useCallback((next: YouVersionBible | null) => {
    if (next) setBibleState(next);
  }, []);

  const resolveBookTitle = useCallback(
    (bookId: string) => resolveBookDisplay(bookId, books),
    [books],
  );

  return {
    books,
    bible,
    setBible,
    catalogSource,
    isOffline,
    isNetworkRefresh,
    refreshCatalog,
    resolveBookTitle,
  };
}
