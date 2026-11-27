import { Capacitor, registerPlugin } from "@capacitor/core";
import { Animation, StatusBar } from "@capacitor/status-bar";

type ImmersiveModeNative = {
  enter(): Promise<void>;
  exit(): Promise<void>;
};

/** Plugin nativo (android/…/ImmersiveModePlugin.java). */
const native = registerPlugin<ImmersiveModeNative>("ImmersiveMode");

/**
 * APK: esconde/mostra totalmente as barras do sistema (estado + navegação).
 * APK antigo sem o plugin → cai para só a barra de estado. Web: no-op.
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
