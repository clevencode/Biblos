/**
 * Estado canónico do menu radial da shell.
 * Espelha padrões do projeto (data-* no <html> + CustomEvent), para
 * leitores / FABs / overlays reagirem sem acoplar AppShellNav ↔ Bible.
 *
 * Não usa inert no main: a topbar (.bible-yv-top) permanece tocável;
 * single-modal = radial fecha ao usar topbar / ao abrir overlay do leitor.
 */

export const SHELL_RADIAL_EVENT = "biblos-shell-radial";

export type ShellRadialDetail = {
  open: boolean;
};

function syncDocumentFlag(open: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("is-radial-open", open);
  if (open) root.setAttribute("data-radial-open", "true");
  else root.removeAttribute("data-radial-open");
}

/** Publica abertura/fecho do radial (DOM + evento). Idempotente. */
export function setShellRadialOpen(open: boolean): void {
  if (typeof document === "undefined") return;
  const wasOpen = isShellRadialOpen();
  if (wasOpen === open) {
    syncDocumentFlag(open);
    return;
  }
  syncDocumentFlag(open);
  window.dispatchEvent(
    new CustomEvent<ShellRadialDetail>(SHELL_RADIAL_EVENT, {
      detail: { open },
    }),
  );
}

export function isShellRadialOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-radial-open") === "true";
}

export function subscribeShellRadial(
  onChange: (open: boolean) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ShellRadialDetail>).detail;
    if (!detail || typeof detail.open !== "boolean") return;
    onChange(detail.open);
  };
  window.addEventListener(SHELL_RADIAL_EVENT, handler);
  return () => window.removeEventListener(SHELL_RADIAL_EVENT, handler);
}

/** Limpa flag (unmount da nav). */
export function clearShellRadialOpen(): void {
  if (typeof document === "undefined") return;
  if (!isShellRadialOpen()) {
    syncDocumentFlag(false);
    return;
  }
  syncDocumentFlag(false);
  window.dispatchEvent(
    new CustomEvent<ShellRadialDetail>(SHELL_RADIAL_EVENT, {
      detail: { open: false },
    }),
  );
}
