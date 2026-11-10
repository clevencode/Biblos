import { useEffect, useState } from "react";
import type { FirestoreError } from "firebase/firestore";
import type { ReadingPlan } from "../../../domain/types";
import {
  subscribeEditorReadingPlans,
  warmupReadingPlansRepository,
} from "../../../data/readingPlansRepository";

export function useAdminReadingPlans(enabled: boolean) {
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [hydrating, setHydrating] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHydrating(false);
      return undefined;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    setHydrating(true);
    setError(null);

    void warmupReadingPlansRepository().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setError("Firestore indisponible");
        setHydrating(false);
        return;
      }

      const sub = subscribeEditorReadingPlans({
        onData: ({ plans: next, fromCache: cache }) => {
          if (cancelled) return;
          setPlans(next);
          setFromCache(cache);
          setHydrating(false);
        },
        onError: (err: FirestoreError) => {
          if (cancelled) return;
          setError(err.message);
          setHydrating(false);
        },
      });

      unsubscribe = sub ? () => sub() : null;
      if (!sub) {
        setError("Écoute Firestore impossible");
        setHydrating(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [enabled]);

  return {
    plans,
    fromCache,
    hydrating,
    error,
    showSkeleton: hydrating && plans.length === 0,
  };
}
