/**
 * Mobile-first : pull CMS Notion (plans + catalogue) et notifications.
 * Données utilisateur → Firebase via userProfileSync / activitySync (hors hook).
 */
import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { Capacitor } from "@capacitor/core";
import { pullCatalog, persistCatalogCache } from "./catalogSync";
import { isNotionCmsPullEnabled } from "./contentCms";
import { DESCRIPTION_PULL_MS, pullPlanDescription } from "./planDescriptionSync";
import { pullRemoteAppNotifications } from "./appNotifications";
import { isFirebaseSignedIn, loadOrCreateProfile } from "./userProfile";
import { runUserCloudSync } from "./firebase/syncSession";
import { ensureLocalMarksInCatalog } from "./verseLocalCatalog";
import type { Catalog, CenterMode, ReadingPlan } from "./types";
import { useAppReadinessOptional } from "./context/AppReadinessContext";
import { apiUrl } from "./apiBase";

const CATALOG_PULL_MS = 45_000;
const HEALTH_PULL_MS = 60_000;

function cmsDeferred(modeRef: MutableRefObject<CenterMode>): boolean {
  return Capacitor.isNativePlatform() && modeRef.current === "bible";
}

function cmsPaused(): boolean {
  return !isNotionCmsPullEnabled();
}

async function probeCmsHealth(): Promise<{
  ok: boolean;
  hasToken?: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(apiUrl("/api/notifications?limit=1"));
    if (!response.ok) {
      return { ok: false, error: "CMS indisponible" };
    }
    const data = (await response.json()) as { ok?: boolean; hasToken?: boolean };
    return { ok: Boolean(data.ok), hasToken: data.hasToken };
  } catch {
    return { ok: false, error: "CMS indisponible" };
  }
}

export function useCmsSync(options: {
  catalog: Catalog;
  setCatalog: Dispatch<SetStateAction<Catalog>>;
  modeRef: MutableRefObject<CenterMode>;
  activePlan?: ReadingPlan | null;
}): { cmsHealth: "unknown" | "ok" | "no-token" | "down" } {
  const { catalog, setCatalog, modeRef, activePlan } = options;
  const readiness = useAppReadinessOptional();
  const [cmsHealth, setCmsHealth] = useState<"unknown" | "ok" | "no-token" | "down">("unknown");
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  const setCmsPulling = (value: boolean) => {
    readiness?.setCmsPulling(value);
  };

  useEffect(() => {
    if (cmsPaused()) return;
    void pullRemoteAppNotifications();
    const profile = loadOrCreateProfile();
    if (isFirebaseSignedIn(profile)) {
      readiness?.registerCloudSync(true);
      void runUserCloudSync({ push: false, pull: true })
        .then((r) => {
          if (r.ok) readiness?.markCloudSyncSuccess();
        })
        .finally(() => readiness?.registerCloudSync(false));
    }
  }, [readiness]);

  useEffect(() => {
    let cancelled = false;
    let busy = false;

    async function syncCatalog() {
      if (busy || cancelled || cmsDeferred(modeRef) || cmsPaused()) return;
      busy = true;
      setCmsPulling(true);
      try {
        const result = await pullCatalog(catalogRef.current);
        if (!cancelled && result.ok) {
          const merged = ensureLocalMarksInCatalog(result.catalog);
          if (result.changed || merged !== result.catalog) {
            setCatalog(merged);
          }
          readiness?.markCloudSyncSuccess();
        }
      } finally {
        busy = false;
        setCmsPulling(false);
      }
    }

    void syncCatalog();
    const timer = window.setInterval(() => void syncCatalog(), CATALOG_PULL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncCatalog();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
  }, [setCatalog, modeRef]);

  useEffect(() => {
    if (!activePlan?.url || cmsPaused()) return;
    let cancelled = false;
    let busy = false;

    async function syncDescription() {
      if (
        busy ||
        cancelled ||
        document.visibilityState === "hidden" ||
        cmsDeferred(modeRef)
      ) {
        return;
      }
      busy = true;
      try {
        const result = await pullPlanDescription(catalogRef.current.plans, activePlan);
        if (!cancelled && result.changed) {
          setCatalog((prev) => {
            const next = { ...prev, plans: result.plans };
            persistCatalogCache(next);
            return next;
          });
        }
      } finally {
        busy = false;
      }
    }

    void syncDescription();
    const timer = window.setInterval(() => void syncDescription(), DESCRIPTION_PULL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncDescription();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activePlan?.id, activePlan?.url, setCatalog, modeRef]);

  useEffect(() => {
    if (cmsPaused()) {
      setCmsHealth("down");
      return;
    }
    let cancelled = false;
    async function check() {
      const health = await probeCmsHealth();
      if (cancelled) return;
      if (!health.ok) {
        setCmsHealth("down");
        return;
      }
      setCmsHealth(health.hasToken === false ? "no-token" : "ok");
    }
    void check();
    const timer = window.setInterval(() => void check(), HEALTH_PULL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { cmsHealth };
}
