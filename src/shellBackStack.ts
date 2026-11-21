/**
 * Pilha de voltar da shell — evento para o leitor consumir overlays
 * (mesmo padrão de publicação que shellRadial).
 */

export const SHELL_BACK_EVENT = "biblos-shell-back";

export type ShellBackDetail = {
  handled: boolean;
};

/** Pede ao leitor que feche o overlay topo. Devolve true se consumido. */
export function requestReaderShellBack(): boolean {
  if (typeof window === "undefined") return false;
  const detail: ShellBackDetail = { handled: false };
  window.dispatchEvent(
    new CustomEvent<ShellBackDetail>(SHELL_BACK_EVENT, { detail }),
  );
  return detail.handled;
}

/** O leitor regista um handler; se devolver true, marca o evento como handled. */
export function subscribeReaderShellBack(
  onBack: () => boolean,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const custom = event as CustomEvent<ShellBackDetail>;
    if (!custom.detail) return;
    if (onBack()) custom.detail.handled = true;
  };
  window.addEventListener(SHELL_BACK_EVENT, handler);
  return () => window.removeEventListener(SHELL_BACK_EVENT, handler);
}
