import { useEffect, useState } from "react";
import type { FirestoreError } from "firebase/firestore";
import { isReadingPlansFirebaseConfigured } from "../../data/firebaseConfig";
import { loadPublishedPlansCache } from "../../data/readingPlansLocalCache";
import {
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
  /** true enquanto não houve primeiro snapshot nem cache local. */
  isInitialLoading: boolean;
};

function initialState(): ReadingPlansCatalogState {
  if (!isReadingPlansFirebaseConfigured()) {
    return {
      status: "unconfigured",
      plans: [],
      fromCache: false,
      error: null,
      isInitialLoading: false,
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
    };
  }
  return {
    status: "hydrating",
    plans: [],
    fromCache: false,
    error: null,
    isInitialLoading: true,
  };
}

/**
 * Presentation — Firestore online + mirror local offline.
 * Progresso do plano continua em planProgress + user-sync.
 */
export function useReadingPlansCatalog(enabled: boolean): ReadingPlansCatalogState {
  const [state, setState] = useState<ReadingPlansCatalogState>(initialState);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!isReadingPlansFirebaseConfigured()) {
      setState({
        status: "unconfigured",
        plans: [],
        fromCache: false,
        error: null,
        isInitialLoading: false,
      });
      return undefined;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const cached = loadPublishedPlansCache();
    if (cached?.plans.length) {
      setState({
        status: "ready",
        plans: cached.plans,
        fromCache: true,
        error: null,
        isInitialLoading: false,
      });
    } else {
      setState((prev) => ({
        ...prev,
        status: "hydrating",
        error: null,
        isInitialLoading: prev.plans.length === 0,
      }));
    }

    void warmupReadingPlansRepository().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        const fallback = loadPublishedPlansCache();
        if (fallback?.plans.length) {
          setState({
            status: "ready",
            plans: fallback.plans,
            fromCache: true,
            error: null,
            isInitialLoading: false,
          });
          return;
        }
        setState({
          status: "error",
          plans: [],
          fromCache: false,
          error: "Firestore indisponible",
          isInitialLoading: false,
        });
        return;
      }

      const sub = subscribePublishedReadingPlans({
        onData: ({ plans, fromCache }) => {
          if (cancelled) return;
          setState({
            status: "ready",
            plans,
            fromCache,
            error: null,
            isInitialLoading: false,
          });
        },
        onError: (err: FirestoreError) => {
          if (cancelled) return;
          const fallback = loadPublishedPlansCache();
          if (fallback?.plans.length) {
            setState({
              status: "ready",
              plans: fallback.plans,
              fromCache: true,
              error: null,
              isInitialLoading: false,
            });
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
              };
            }
            return {
              status: "error",
              plans: [],
              fromCache: false,
              error: err.message || "Erreur Firestore",
              isInitialLoading: false,
            };
          });
        },
      });

      unsubscribe = sub ? () => sub() : null;
      if (!sub) {
        const fallback = loadPublishedPlansCache();
        if (fallback?.plans.length) {
          setState({
            status: "ready",
            plans: fallback.plans,
            fromCache: true,
            error: null,
            isInitialLoading: false,
          });
          return;
        }
        setState({
          status: "error",
          plans: [],
          fromCache: false,
          error: "Firestore indisponible",
          isInitialLoading: false,
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [enabled]);

  return state;
}
