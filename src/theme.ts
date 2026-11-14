/** Thème CLEVENCODE — light | dark | system. */

import {
  getStorageAdapter,
  STORAGE_PREF_KEYS,
} from "./services/storage/StorageAdapter";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = STORAGE_PREF_KEYS.theme;

/** Âncoras do color system (CSS: --ink / --paper). */
export const BRAND_INK = "#0D1117";
export const BRAND_PAPER = "#FFFFFF";

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: BRAND_PAPER,
  dark: BRAND_INK,
};

export function isThemePref(value: unknown): value is ThemePref {
  return value === "light" || value === "dark" || value === "system";
}

/** Leitura síncrona (localStorage / espelho Preferences). */
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
  void getStorageAdapter().setString(THEME_STORAGE_KEY, pref);
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

/** Toggle d’apparence : uniquement clair ↔ sombre (quitte `system` si besoin). */
export function nextThemePref(pref: ThemePref): ThemePref {
  return resolveTheme(pref) === "light" ? "dark" : "light";
}

export function themePrefLabel(pref: ThemePref): string {
  const resolved = resolveTheme(pref);
  return resolved === "light" ? "Thème clair" : "Thème sombre";
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
