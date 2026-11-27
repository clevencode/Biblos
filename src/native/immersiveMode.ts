import { Capacitor, registerPlugin } from "@capacitor/core";
import { Animation, StatusBar } from "@capacitor/status-bar";

type ImmersiveModeNative = {
  enter(): Promise<void>;
  exit(): Promise<void>;
};

/** Plugin nativo (android/…/ImmersiveModePlugin.java). */
const native = registerPlugin<ImmersiveModeNative>("ImmersiveMode");

/**
 * Barras do sistema na tela cheia do leitor.
 *
 * - APK: plugin nativo esconde barra de estado + navegação, sem aviso do
 *   sistema (APK antigo sem o plugin → só a barra de estado).
 * - Navegador e PWA instalada: nada. Esconder as barras exigiria a
 *   Fullscreen API, e o Chrome acompanha-a sempre do seu próprio aviso
 *   (« <domínio> - Faites glisser… pour quitter le plein écran »), que não
 *   pode ser alterado nem escondido. A app mostra o seu aviso próprio.
 */
export async function setSystemBarsHidden(hidden: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await (hidden ? native.enter() : native.exit());
    return;
  } catch {
    /* plugin ausente nesta build: fallback abaixo */
  }
  try {
    if (hidden) await StatusBar.hide({ animation: Animation.Fade });
    else await StatusBar.show({ animation: Animation.Fade });
  } catch {
    /* sem barras controláveis: o modo do leitor segue só com CSS */
  }
}
