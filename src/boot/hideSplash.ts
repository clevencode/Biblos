/**
 * Oculta splash nativa + overlay web no gate local_ready.
 */

import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

let hidden = false;

export async function hideAppSplash(): Promise<void> {
  if (hidden) return;
  hidden = true;

  const overlay = document.getElementById("splash-overlay");
  if (overlay) {
    overlay.setAttribute("data-hidden", "true");
    overlay.setAttribute("aria-busy", "false");
    overlay.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      overlay.remove();
    }, 280);
  }

  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch (error) {
    console.warn("[splash] hide failed", error);
  }
}
