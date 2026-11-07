import type { CenterMode } from "./types";

export type ShellTabDef = { id: CenterMode; label: string };

export const ALL_SHELL_TABS: ShellTabDef[] = [
  { id: "home", label: "Accueil" },
  { id: "today", label: "Plan" },
  { id: "bible", label: "Bible" },
  { id: "cards", label: "Cartes" },
  { id: "profile", label: "Profil" },
];

/**
 * Tab bar: Accueil, Plan, Bible, Profil (Cartes opcional via flag).
 */
export const ENABLED_SHELL_TAB_IDS: ReadonlySet<CenterMode> = new Set([
  "home",
  "today",
  "bible",
  "profile",
]);

export const DEFAULT_SHELL_MODE: CenterMode = "today";

export function isShellTabEnabled(mode: CenterMode): boolean {
  return ENABLED_SHELL_TAB_IDS.has(mode);
}

export function visibleShellTabs(): ShellTabDef[] {
  return ALL_SHELL_TABS.filter((tab) => isShellTabEnabled(tab.id));
}

export function coerceShellMode(mode: CenterMode): CenterMode {
  if (isShellTabEnabled(mode)) return mode;
  return DEFAULT_SHELL_MODE;
}
