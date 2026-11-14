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

/** Se o reader não marcar catálogo, não segurar splash para sempre. */
const SHELL_FALLBACK_MS = 900;

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

  // Fallback: shell montado mas bible nunca hidrata o catálogo.
  useEffect(() => {
    if (!shellReady || catalogLocalReady) return;
    const id = window.setTimeout(() => {
      setCatalogHydrating(false);
      setCatalogLocalReady(true);
    }, SHELL_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [shellReady, catalogLocalReady]);

  useEffect(() => {
    if (phase === "hydrating" || splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    void syncNativeChrome(applyTheme());
    void hideAppSplash();
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
