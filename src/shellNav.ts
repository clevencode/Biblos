/** Destinos principais da shell : Bible · Plan (labels via i18n). */
export type ShellTab = "bible" | "plan";

export type ShellTabDef = {
  id: ShellTab;
  /** Chave i18n em uiCopy (shell.*). */
  labelKey: "shell.plan" | "shell.bible";
};

export const SHELL_TABS: readonly ShellTabDef[] = [
  { id: "bible", labelKey: "shell.bible" },
  { id: "plan", labelKey: "shell.plan" },
] as const;

export const DEFAULT_SHELL_TAB: ShellTab = "bible";

const UI_KEY = "biblos-ui";

const TAB_SET = new Set<ShellTab>(SHELL_TABS.map((t) => t.id));

function coerceTab(value: unknown): ShellTab {
  if (typeof value === "string") {
    /* Migração: Accueil → Plan; Profil → Bible (conta fica no radial). */
    if (value === "home" || value === "today") return "plan";
    if (value === "profile") return DEFAULT_SHELL_TAB;
    if (TAB_SET.has(value as ShellTab)) return value as ShellTab;
  }
  return DEFAULT_SHELL_TAB;
}

export function loadShellTab(): ShellTab {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return DEFAULT_SHELL_TAB;
    const parsed = JSON.parse(raw) as { tab?: string; mode?: string };
    if (parsed.tab) return coerceTab(parsed.tab);
    /* Legado: ler `mode` uma vez se `tab` ausente. */
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
    const next: Record<string, unknown> = { ...base, tab };
    delete next.mode;
    localStorage.setItem(UI_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
