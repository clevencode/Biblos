/**
 * requestIdleCallback com polyfill (Safari) e cancelamento.
 */

import type { IdleTaskOptions } from "../contracts/power-governor.contract";

type IdleDeadlineLike = { didTimeout: boolean; timeRemaining: () => number };

type RicHandle = number;

function hasRic(): boolean {
  return typeof window !== "undefined" && typeof requestIdleCallback === "function";
}

/**
 * Agenda tarefa ociosa. Retorna cancelador.
 */
export function scheduleIdleTask(
  task: () => void | Promise<void>,
  options?: IdleTaskOptions,
): () => void {
  const timeoutMs = options?.timeoutMs ?? 3000;
  let cancelled = false;
  let handle: RicHandle | ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    if (cancelled) return;
    try {
      const result = task();
      if (result && typeof (result as Promise<void>).then === "function") {
        void (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* tarefa isolada */
    }
  };

  if (typeof window === "undefined") {
    run();
    return () => undefined;
  }

  if (hasRic()) {
    handle = requestIdleCallback(
      (_deadline: IdleDeadlineLike) => {
        if (!cancelled) run();
      },
      { timeout: timeoutMs },
    );
    return () => {
      cancelled = true;
      if (handle != null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(handle as number);
      }
    };
  }

  // Polyfill: delay curto; priority low → delay maior
  const delay =
    options?.priority === "low" ? Math.min(timeoutMs, 800) : 1;
  handle = window.setTimeout(run, delay);
  return () => {
    cancelled = true;
    if (handle != null) window.clearTimeout(handle as ReturnType<typeof setTimeout>);
  };
}
