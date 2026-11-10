import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readBrowserOffline } from "../bible/bibleCatalogRepository";

export type AppLifecyclePhase = "hydrating" | "local_ready" | "fully_synced";

type AppReadinessContextValue = {
  phase: AppLifecyclePhase;
  setCatalogHydrating: (value: boolean) => void;
  setCatalogLocalReady: (value: boolean) => void;
};

const AppReadinessContext = createContext<AppReadinessContextValue | null>(null);

export function AppReadinessProvider({ children }: { children: ReactNode }) {
  const [catalogHydrating, setCatalogHydrating] = useState(true);
  const [catalogLocalReady, setCatalogLocalReady] = useState(false);
  const [, setBrowserOffline] = useState(readBrowserOffline);

  const phase: AppLifecyclePhase = useMemo(() => {
    if (catalogHydrating || !catalogLocalReady) return "hydrating";
    return "fully_synced";
  }, [catalogHydrating, catalogLocalReady]);

  const value = useMemo<AppReadinessContextValue>(
    () => ({
      phase,
      setCatalogHydrating,
      setCatalogLocalReady,
    }),
    [phase],
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
