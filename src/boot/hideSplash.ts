/**
 * Esconde a splash nativa (Capacitor).
 * Chamar só após shell estável (prefs + markShellReady + 2 rAF) — anti-CLS no relançamento.
 */

import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

let hidden = false;

export async function hideAppSplash(): Promise<void> {
  if (hidden) return;
  hidden = true;

  const overlay = document.getElementById("splash-overlay");
  if (overlay) overlay.remove();

  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 0 });
  } catch (error) {
    console.warn("[splash] hide failed", error);
  }
}
