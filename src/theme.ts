/** Thème CLEVENCODE — light | dark | system. */

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "biblos-theme";

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#FFFFFF",
  dark: "#0d1117",
};

const PREFS: readonly ThemePref[] = ["light", "dark", "system"];

export function isThemePref(value: unknown): value is ThemePref {
  return value === "light" || value === "dark" || value === "system";
}

export function loadThemePref(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePref(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

export function saveThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveTheme(pref: ThemePref = loadThemePref()): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

export function nextThemePref(pref: ThemePref): ThemePref {
  const i = PREFS.indexOf(pref);
  return PREFS[(i + 1) % PREFS.length]!;
}

export function themePrefLabel(pref: ThemePref): string {
  if (pref === "light") return "Thème clair";
  if (pref === "dark") return "Thème sombre";
  return "Thème système";
}

export function updateThemeColorMeta(resolved: ResolvedTheme): void {
  const color = THEME_COLORS[resolved];
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);
  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (apple) {
    apple.setAttribute("content", resolved === "dark" ? "black-translucent" : "default");
  }
}

/** Applique le thème résolu sur <html> + meta. */
export function applyTheme(pref: ThemePref = loadThemePref()): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  root.style.backgroundColor = "";
  root.style.color = "";
  updateThemeColorMeta(resolved);
  return resolved;
}

/** Écoute OS quand pref === system. Retourne unsubscribe. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
