import { useCallback, useEffect, useState } from "react";
import type { FirestoreError } from "firebase/firestore";
import { isReadingPlansFirebaseConfigured } from "../../data/firebaseConfig";
import { loadPublishedPlansCache } from "../../data/readingPlansLocalCache";
import {
  pullPublishedReadingPlans,
  subscribePublishedReadingPlans,
  warmupReadingPlansRepository,
} from "../../data/readingPlansRepository";
import type { ReadingPlan } from "../../domain/types";

export type ReadingPlansCatalogStatus =
  | "unconfigured"
  | "hydrating"
  | "ready"
  | "error";

export type ReadingPlansCatalogState = {
  status: ReadingPlansCatalogStatus;
  plans: ReadingPlan[];
  fromCache: boolean;
  error: string | null;
  /** true enquanto não houve primeiro snapshot de rede nem cache local útil. */
  isInitialLoading: boolean;
  /** empty após sync de rede (não é “ainda a sincronizar”). */
  emptyAfterSync: boolean;
  retry: () => void;
};

function initialState(): Omit<ReadingPlansCatalogState, "retry"> {
  if (!isReadingPlansFirebaseConfigured()) {
    return {
      status: "unconfigured",
      plans: [],
      fromCache: false,
      error: null,
      isInitialLoading: false,
      emptyAfterSync: false,
    };
  }
  const cached = loadPublishedPlansCache();
  if (cached?.plans.length) {
    return {
      status: "ready",
      plans: cached.plans,
      fromCache: true,
      error: null,
      isInitialLoading: false,
      emptyAfterSync: false,
    };
  }
  return {
    status: "hydrating",
    plans: [],
    fromCache: false,
    error: null,
    isInitialLoading: true,
    emptyAfterSync: false,
  };
}

function readyWithPlans(
  plans: ReadingPlan[],
  fromCache: boolean,
): Omit<ReadingPlansCatalogState, "retry"> {
  return {
    status: "ready",
    plans,
    fromCache,
    error: null,
    isInitialLoading: false,
    emptyAfterSync: plans.length === 0 && !fromCache,
  };
}

function resolveEmptyWithMirror(): Omit<ReadingPlansCatalogState, "retry"> | null {
  const fallback = loadPublishedPlansCache();
  if (fallback?.plans.length) {
    return readyWithPlans(fallback.plans, true);
  }
  return null;
}

/**
 * Presentation — Firestore online + mirror local offline.
 * Progresso do plano continua em planProgress + user-sync.
 */
export function useReadingPlansCatalog(enabled: boolean): ReadingPlansCatalogState {
  const [state, setState] = useState(initialState);
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    setRetryToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!isReadingPlansFirebaseConfigured()) {
      setState({
        status: "unconfigured",
        plans: [],
        fromCache: false,
        error: null,
        isInitialLoading: false,
        emptyAfterSync: false,
      });
      return undefined;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let emptyCachePullStarted = false;
    let hydrateWatchdog: ReturnType<typeof setTimeout> | null = null;

    const armHydrateWatchdog = () => {
      if (hydrateWatchdog) return;
      hydrateWatchdog = setTimeout(() => {
        if (cancelled) return;
        setState((prev) => {
          if (prev.status !== "hydrating" || prev.plans.length > 0) return prev;
          const mirrored = resolveEmptyWithMirror();
          if (mirrored) return mirrored;
          return {
            status: "ready",
            plans: [],
            fromCache: false,
            error: null,
            isInitialLoading: false,
            emptyAfterSync: true,
          };
        });
      }, 10_000);
    };

    const cached = loadPublishedPlansCache();
    if (cached?.plans.length) {
      setState(readyWithPlans(cached.plans, true));
    } else {
      setState((prev) => ({
        ...prev,
        status: "hydrating",
        error: null,
        emptyAfterSync: false,
        isInitialLoading: prev.plans.length === 0,
      }));
    }

    const settleEmptyFromNetwork = () => {
      const mirrored = resolveEmptyWithMirror();
      if (mirrored) {
        setState(mirrored);
        return;
      }
      setState({
        status: "ready",
        plans: [],
        fromCache: false,
        error: null,
        isInitialLoading: false,
        emptyAfterSync: true,
      });
    };

    const pullAfterEmptyCache = () => {
      if (emptyCachePullStarted) return;
      emptyCachePullStarted = true;
      void pullPublishedReadingPlans().then((pulled) => {
        if (cancelled) return;
        if (pulled?.plans.length) {
          setState(readyWithPlans(pulled.plans, pulled.fromCache));
          return;
        }
        if (pulled && !pulled.fromCache) {
          settleEmptyFromNetwork();
          return;
        }
        const mirrored = resolveEmptyWithMirror();
        if (mirrored) {
          setState(mirrored);
          return;
        }
        /* Mantém hydrating até snapshot de rede; se já tínhamos ready empty, não piorar. */
        setState((prev) => {
          if (prev.plans.length > 0) return prev;
          return {
            ...prev,
            status: "hydrating",
            isInitialLoading: true,
            emptyAfterSync: false,
            error: null,
          };
        });
      });
    };

    void warmupReadingPlansRepository().then(async (ok) => {
      if (cancelled) return;
      if (!ok) {
        const pulled = await pullPublishedReadingPlans();
        if (cancelled) return;
        if (pulled?.plans.length) {
          setState(readyWithPlans(pulled.plans, pulled.fromCache));
          return;
        }
        const mirrored = resolveEmptyWithMirror();
        if (mirrored) {
          setState(mirrored);
          return;
        }
        setState({
          status: "error",
          plans: [],
          fromCache: false,
          error: "Firestore indisponible",
          isInitialLoading: false,
          emptyAfterSync: false,
        });
        return;
      }

      const sub = subscribePublishedReadingPlans({
        onData: ({ plans, fromCache }) => {
          if (cancelled) return;

          if (plans.length === 0 && fromCache) {
            setState((prev) => {
              if (prev.plans.length > 0) {
                return {
                  ...prev,
                  status: "ready",
                  fromCache: true,
                  error: null,
                  isInitialLoading: false,
                  emptyAfterSync: false,
                };
              }
              return {
                status: "hydrating",
                plans: [],
                fromCache: true,
                error: null,
                isInitialLoading: true,
                emptyAfterSync: false,
              };
            });
            armHydrateWatchdog();
            pullAfterEmptyCache();
            return;
          }

          if (plans.length === 0) {
            const mirrored = resolveEmptyWithMirror();
            if (mirrored) {
              setState(mirrored);
              return;
            }
            setState({
              status: "ready",
              plans: [],
              fromCache: false,
              error: null,
              isInitialLoading: false,
              emptyAfterSync: true,
            });
            return;
          }

          setState(readyWithPlans(plans, fromCache));
        },
        onError: (err: FirestoreError) => {
          if (cancelled) return;
          void pullPublishedReadingPlans().then((pulled) => {
            if (cancelled) return;
            if (pulled?.plans.length) {
              setState(readyWithPlans(pulled.plans, pulled.fromCache));
              return;
            }
            const mirrored = resolveEmptyWithMirror();
            if (mirrored) {
              setState(mirrored);
              return;
            }
            setState((prev) => {
              if (prev.plans.length > 0) {
                return {
                  ...prev,
                  status: "ready",
                  fromCache: true,
                  error: null,
                  isInitialLoading: false,
                  emptyAfterSync: false,
                };
              }
              return {
                status: "error",
                plans: [],
                fromCache: false,
                error: err.message || "Erreur Firestore",
                isInitialLoading: false,
                emptyAfterSync: false,
              };
            });
          });
        },
      });

      unsubscribe = sub ? () => sub() : null;
      if (!sub) {
        const pulled = await pullPublishedReadingPlans();
        if (cancelled) return;
        if (pulled?.plans.length) {
          setState(readyWithPlans(pulled.plans, pulled.fromCache));
          return;
        }
        const mirrored = resolveEmptyWithMirror();
        if (mirrored) {
          setState(mirrored);
          return;
        }
        setState({
          status: "error",
          plans: [],
          fromCache: false,
          error: "Firestore indisponible",
          isInitialLoading: false,
          emptyAfterSync: false,
        });
      }
    });

    return () => {
      cancelled = true;
      if (hydrateWatchdog) clearTimeout(hydrateWatchdog);
      unsubscribe?.();
    };
  }, [enabled, retryToken]);

  return { ...state, retry };
}
