import type { CenterMode } from "./types";

/**
 * Navegação entre vues centrais (Accueil, Plan, Bible, Cartes, Profil).
 *
 * Coesão: regras de negócio do shell ficam aqui, não espalhadas nos handlers de UI.
 * - `planDay` (detalhe do dia vs galeria) só muda por fluxos explícitos (galeria, Escape, pick plan).
 * - Tab bar efectiva: ver `appShellConfig.ts` (ENABLED_SHELL_TAB_IDS).
 */

export type CenterNavigationState = {
  mode: CenterMode;
  planDay: boolean;
};

/** Troca de aba primária: preserva planDay. */
export function navigatePrimaryTab(
  state: CenterNavigationState,
  target: CenterMode,
): CenterNavigationState {
  if (target === state.mode) return state;
  return { mode: target, planDay: state.planDay };
}

/** Montagem adiada: painel pesado só após primeira visita (keep-alive depois). */
export function shouldKeepPanelMounted(
  panel: CenterMode,
  currentMode: CenterMode,
  alreadyMounted: boolean,
): boolean {
  return alreadyMounted || currentMode === panel;
}
