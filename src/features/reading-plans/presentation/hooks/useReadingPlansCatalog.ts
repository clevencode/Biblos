import { useEffect, useState } from "react";
import type { FirestoreError } from "firebase/firestore";
import { isReadingPlansFirebaseConfigured } from "../../data/firebaseConfig";
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
  /** true enquanto não houve primeiro snapshot. */
  isInitialLoading: boolean;
};

const INITIAL: ReadingPlansCatalogState = {
  status: "hydrating",
  plans: [],
  fromCache: false,
  error: null,
  isInitialLoading: true,
};

/**
 * Presentation hook — orquestra repositório; nunca importa config Firebase.
 */
export function useReadingPlansCatalog(enabled: boolean): ReadingPlansCatalogState {
  const [state, setState] = useState<ReadingPlansCatalogState>(() =>
    !isReadingPlansFirebaseConfigured()
      ? {
          status: "unconfigured",
          plans: [],
          fromCache: false,
          error: null,
          isInitialLoading: false,
        }
      : INITIAL,
  );

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

    setState((prev) => ({
      ...prev,
      status: "hydrating",
      error: null,
      isInitialLoading: prev.plans.length === 0,
    }));

    void warmupReadingPlansRepository().then((ok) => {
      if (cancelled) return;
      if (!ok) {
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
          setState((prev) => ({
            status: "error",
            plans: prev.plans,
            fromCache: prev.fromCache,
            error: err.message || "Erreur Firestore",
            isInitialLoading: false,
          }));
        },
      });

      unsubscribe = sub ? () => sub() : null;
      if (!sub) {
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
