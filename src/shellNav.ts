/** Onglets principaux : Accueil · Plan · Bible · Profil (labels via i18n). */
export type ShellTab = "home" | "today" | "bible" | "profile";

export type ShellTabDef = {
  id: ShellTab;
  /** Chave i18n em uiCopy (shell.*). */
  labelKey: "shell.home" | "shell.plan" | "shell.bible" | "shell.profile";
};

export const SHELL_TABS: readonly ShellTabDef[] = [
  { id: "home", labelKey: "shell.home" },
  { id: "today", labelKey: "shell.plan" },
  { id: "bible", labelKey: "shell.bible" },
  { id: "profile", labelKey: "shell.profile" },
] as const;

export const DEFAULT_SHELL_TAB: ShellTab = "bible";

const UI_KEY = "biblos-ui";

const TAB_SET = new Set<ShellTab>(SHELL_TABS.map((t) => t.id));

function coerceTab(value: unknown): ShellTab {
  if (typeof value === "string" && TAB_SET.has(value as ShellTab)) {
    return value as ShellTab;
  }
  return DEFAULT_SHELL_TAB;
}

export function loadShellTab(): ShellTab {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return DEFAULT_SHELL_TAB;
    const parsed = JSON.parse(raw) as { tab?: string; mode?: string };
    if (parsed.tab) return coerceTab(parsed.tab);
    if (parsed.mode) return coerceTab(parsed.mode);
  } catch {
    /* ignore */
  }
  return DEFAULT_SHELL_TAB;
}

export function saveShellTab(tab: ShellTab): void {
  try {
    const prev = localStorage.getItem(UI_KEY);
    const base =
      prev && prev.startsWith("{")
        ? (JSON.parse(prev) as Record<string, unknown>)
        : {};
    localStorage.setItem(UI_KEY, JSON.stringify({ ...base, tab, mode: tab }));
  } catch {
    /* ignore */
  }
}
