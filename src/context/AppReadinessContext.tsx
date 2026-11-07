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
import { readBrowserOffline } from "../bible/bibleCatalogRepository";

export type AppLifecyclePhase = "hydrating" | "local_ready" | "fully_synced";

export type CloudSyncSurface = "idle" | "syncing" | "synced" | "offline";

type AppReadinessContextValue = {
  phase: AppLifecyclePhase;
  cloudSync: CloudSyncSurface;
  setCatalogHydrating: (value: boolean) => void;
  setCatalogLocalReady: (value: boolean) => void;
  registerCloudSync: (busy: boolean) => void;
  setCmsPulling: (value: boolean) => void;
  setAuthLoading: (value: boolean) => void;
  markCloudSyncSuccess: () => void;
};

const AppReadinessContext = createContext<AppReadinessContextValue | null>(null);

export function AppReadinessProvider({ children }: { children: ReactNode }) {
  const [catalogHydrating, setCatalogHydrating] = useState(true);
  const [catalogLocalReady, setCatalogLocalReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [cmsPulling, setCmsPulling] = useState(false);
  const [cloudBusyCount, setCloudBusyCount] = useState(0);
  const [lastSyncOk, setLastSyncOk] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(readBrowserOffline);

  const cloudBusyRef = useRef(0);

  const registerCloudSync = useCallback((busy: boolean) => {
    cloudBusyRef.current = Math.max(0, cloudBusyRef.current + (busy ? 1 : -1));
    setCloudBusyCount(cloudBusyRef.current);
  }, []);

  const markCloudSyncSuccess = useCallback(() => {
    setLastSyncOk(true);
  }, []);

  const cloudSyncInFlight = cloudBusyCount > 0 || cmsPulling;

  const phase: AppLifecyclePhase = useMemo(() => {
    if (catalogHydrating || !catalogLocalReady) return "hydrating";
    if (authLoading || cloudSyncInFlight) return "local_ready";
    return "fully_synced";
  }, [catalogHydrating, catalogLocalReady, authLoading, cloudSyncInFlight]);

  const cloudSync: CloudSyncSurface = useMemo(() => {
    if (browserOffline) return "offline";
    if (cloudSyncInFlight) return "syncing";
    if (lastSyncOk) return "synced";
    return "idle";
  }, [browserOffline, cloudSyncInFlight, lastSyncOk]);

  const value = useMemo<AppReadinessContextValue>(
    () => ({
      phase,
      cloudSync,
      setCatalogHydrating,
      setCatalogLocalReady,
      registerCloudSync,
      setCmsPulling,
      setAuthLoading,
      markCloudSyncSuccess,
    }),
    [phase, cloudSync, registerCloudSync, markCloudSyncSuccess],
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
    <AppReadinessContext.Provider value={value}>
      {children}
    </AppReadinessContext.Provider>
  );
}

export function useAppReadiness(): AppReadinessContextValue {
  const ctx = useContext(AppReadinessContext);
  if (!ctx) {
    throw new Error("useAppReadiness must be used within AppReadinessProvider");
  }
  return ctx;
}

/** Leitor fora do Provider (testes) — valores neutros. */
export function useAppReadinessOptional(): AppReadinessContextValue | null {
  return useContext(AppReadinessContext);
}
