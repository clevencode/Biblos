import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

/** Alinha a system bar ao UI claro do StudyOS (só em Capacitor nativo). */
export async function syncNativeChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: "#FFFFFF" });
    await StatusBar.setStyle({ style: Style.Light });
  } catch (error) {
    console.warn("status bar setup failed", error);
  }
}
