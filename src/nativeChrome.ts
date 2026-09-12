import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { THEME_COLORS, type ResolvedTheme } from "./theme";

/** Alinha a system bar ao tema resolvido (só em Capacitor nativo). */
export async function syncNativeChrome(resolved: ResolvedTheme = "light"): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const color = THEME_COLORS[resolved];
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color });
    await StatusBar.setStyle({
      style: resolved === "dark" ? Style.Dark : Style.Light,
    });
  } catch (error) {
    console.warn("status bar setup failed", error);
  }
}
