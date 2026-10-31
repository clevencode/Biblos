/** Agenda trabalho pesado após o primeiro frame (mobile WebView). */
export function scheduleIdle(work: () => void, timeoutMs = 5000): void {
  if (typeof window === "undefined") return;
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => work(), { timeout: timeoutMs });
    return;
  }
  window.setTimeout(work, Math.min(1200, timeoutMs));
}
