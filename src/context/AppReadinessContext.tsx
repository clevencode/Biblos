import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { hideAppSplash } from "../boot/hideSplash";
import { readBrowserOffline } from "../bible/bibleCatalogRepository";
import { syncNativeChrome } from "../nativeChrome";
import { isPrefsMirrorReady } from "../services/storage/StorageAdapter";
import { applyTheme } from "../theme";

export type AppLifecyclePhase = "hydrating" | "local_ready" | "fully_synced";

type AppReadinessContextValue = {
  phase: AppLifecyclePhase;
  setCatalogHydrating: (value: boolean) => void;
  setCatalogLocalReady: (value: boolean) => void;
  /** Shell montado (home/today/profile) — evita deadlock se bible não montar. */
  markShellReady: () => void;
  /** Prefs reader/tema já espelhadas no boot. */
  markPrefsHydrated: () => void;
};

const AppReadinessContext = createContext<AppReadinessContextValue | null>(null);

/** Shell montado sem hidratação activa (Plan / Bible não montada). */
const SHELL_FALLBACK_MS = 900;
/** Último recurso se a Bible ficar presa em hydrating. */
const HYDRATING_FALLBACK_MS = 8000;

export function AppReadinessProvider({ children }: { children: ReactNode }) {
  const [catalogHydrating, setCatalogHydrating] = useState(true);
  const [catalogLocalReady, setCatalogLocalReady] = useState(false);
  const [shellReady, setShellReady] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(isPrefsMirrorReady);
  const [, setBrowserOffline] = useState(readBrowserOffline);
  const splashHiddenRef = useRef(false);

  const markShellReady = useCallback(() => setShellReady(true), []);
  const markPrefsHydrated = useCallback(() => setPrefsHydrated(true), []);

  const phase: AppLifecyclePhase = useMemo(() => {
    if (!prefsHydrated) return "hydrating";
    if (catalogLocalReady || (shellReady && !catalogHydrating)) {
      return "local_ready";
    }
    if (shellReady && catalogHydrating) return "hydrating";
    return "hydrating";
  }, [prefsHydrated, catalogLocalReady, catalogHydrating, shellReady]);

  const value = useMemo<AppReadinessContextValue>(
    () => ({
      phase,
      setCatalogHydrating,
      setCatalogLocalReady,
      markShellReady,
      markPrefsHydrated,
    }),
    [phase, markShellReady, markPrefsHydrated],
  );

  useEffect(() => {
    const onOffline = () => setBrowserOffline(true);
    const onOnline = () => setBrowserOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  /**
   * Fallback curto só sem hidratação activa (herança BibleReaderView manda).
   * Com `catalogHydrating`, esperar o gate passage+boot — evita CLS pós-splash.
   */
  useEffect(() => {
    if (!shellReady || catalogLocalReady) return;
    const ms = catalogHydrating ? HYDRATING_FALLBACK_MS : SHELL_FALLBACK_MS;
    const id = window.setTimeout(() => {
      setCatalogHydrating(false);
      setCatalogLocalReady(true);
    }, ms);
    return () => window.clearTimeout(id);
  }, [shellReady, catalogLocalReady, catalogHydrating]);

  useEffect(() => {
    if (phase === "hydrating" || splashHiddenRef.current) return;
    let cancelled = false;

    const reveal = async () => {
      try {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 450);
            }),
          ]);
        }
      } catch {
        /* ignore */
      }
      if (cancelled || splashHiddenRef.current) return;
      /* Chrome nativo antes do fade — evita salto de safe-area/status bar. */
      try {
        await syncNativeChrome(applyTheme());
      } catch {
        /* ignore */
      }
      if (cancelled || splashHiddenRef.current) return;
      /* 2 rAF: espera layout + paint (scroll boot) antes do fade do splash. */
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
      if (cancelled || splashHiddenRef.current) return;
      splashHiddenRef.current = true;
      void hideAppSplash();
    };

    void reveal();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  return (
    <AppReadinessContext.Provider value={value}>{children}</AppReadinessContext.Provider>
  );
}

export function useAppReadiness(): AppReadinessContextValue {
  const ctx = useContext(AppReadinessContext);
  if (!ctx) {
    throw new Error("useAppReadiness must be used within AppReadinessProvider");
  }
  return ctx;
}

export function useAppReadinessOptional(): AppReadinessContextValue | null {
  return useContext(AppReadinessContext);
}
