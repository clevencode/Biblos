import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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

/**
 * Boot leve: prefs + shell.
 * Splash nativa só esconde após shell estável (2 rAF) — evita CLS empty→chrome.
 * Loading de conteúdo fica por ecrã (skeleton / barra / stale).
 */
export type AppLifecyclePhase = "hydrating" | "local_ready";

type AppReadinessContextValue = {
  phase: AppLifecyclePhase;
  /** Shell montado (Plan / Bible / account). Preferir useLayoutEffect. */
  markShellReady: () => void;
  /** Prefs reader/tema já espelhadas no boot. */
  markPrefsHydrated: () => void;
};

const AppReadinessContext = createContext<AppReadinessContextValue | null>(null);

export function AppReadinessProvider({ children }: { children: ReactNode }) {
  const [shellReady, setShellReady] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(isPrefsMirrorReady);
  const [, setBrowserOffline] = useState(readBrowserOffline);
  const splashHiddenRef = useRef(false);

  const markShellReady = useCallback(() => setShellReady(true), []);
  const markPrefsHydrated = useCallback(() => setPrefsHydrated(true), []);

  const phase: AppLifecyclePhase =
    prefsHydrated && shellReady ? "local_ready" : "hydrating";

  const value = useMemo<AppReadinessContextValue>(
    () => ({
      phase,
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
   * Padrão anti-CLS definitivo:
   * 1) sync chrome nativo na cor do tema
   * 2) 2 rAF (layout + paint do shell)
   * 3) hide splash (fundo sólido → UI já estável)
   */
  useLayoutEffect(() => {
    if (phase !== "local_ready" || splashHiddenRef.current) return;
    let cancelled = false;

    const reveal = async () => {
      try {
        await syncNativeChrome(applyTheme());
      } catch {
        /* ignore */
      }
      if (cancelled || splashHiddenRef.current) return;

      try {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 120);
            }),
          ]);
        }
      } catch {
        /* ignore */
      }
      if (cancelled || splashHiddenRef.current) return;

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
