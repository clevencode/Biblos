import { Capacitor, registerPlugin } from "@capacitor/core";
import { Animation, StatusBar } from "@capacitor/status-bar";

type ImmersiveModeNative = {
  enter(): Promise<void>;
  exit(): Promise<void>;
};

/** Plugin nativo (android/…/ImmersiveModePlugin.java). */
const native = registerPlugin<ImmersiveModeNative>("ImmersiveMode");

/**
 * Como as barras do sistema foram escondidas:
 * - `native`: APK (barra de estado + navegação, sem aviso);
 * - `browser`: PWA instalada — Fullscreen API (o Chrome mostra o seu aviso);
 * - `none`: não foi possível (separador normal do navegador, recusa…).
 */
export type SystemBarsMode = "native" | "browser" | "none";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
};

export function browserFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * PWA instalada (Chrome « Instalar app » / ecrã principal) num ecrã tátil.
 * Uma página web não tem acesso ao WindowInsetsController do Android: a
 * única forma de esconder as barras a pedido é a Fullscreen API.
 * Num separador normal não a usamos (o aviso nativo não é personalizável).
 */
export function isInstalledTouchWebApp(): boolean {
  if (typeof window === "undefined" || Capacitor.isNativePlatform()) return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const installed =
    nav.standalone === true ||
    ["standalone", "fullscreen", "minimal-ui"].some(
      (mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches,
    );
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return installed && touch;
}

async function setBrowserFullscreen(on: boolean): Promise<boolean> {
  const doc = document as FullscreenDocument;
  try {
    if (on) {
      if (browserFullscreenElement()) return true;
      const root = document.documentElement as FullscreenElement;
      const options: FullscreenOptions = { navigationUI: "hide" };
      if (root.requestFullscreen) await root.requestFullscreen(options);
      else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen(options);
      else return false;
      return Boolean(browserFullscreenElement());
    }
    if (!browserFullscreenElement()) return true;
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
    return true;
  } catch {
    /* sem gesto do utilizador / recusado: segue só com o modo da app */
    return false;
  }
}

/**
 * Esconde/mostra as barras do sistema na tela cheia do leitor.
 * - APK: plugin nativo (estado + navegação); APK antigo → só a barra de estado.
 * - PWA instalada (tátil): Fullscreen API com `navigationUI: "hide"`.
 * - Separador normal do navegador: nada (só o modo da app).
 */
export async function setSystemBarsHidden(hidden: boolean): Promise<SystemBarsMode> {
  if (Capacitor.isNativePlatform()) {
    try {
      await (hidden ? native.enter() : native.exit());
      return "native";
    } catch {
      /* plugin ausente nesta build: fallback abaixo */
    }
    try {
      if (hidden) await StatusBar.hide({ animation: Animation.Fade });
      else await StatusBar.show({ animation: Animation.Fade });
      return "native";
    } catch {
      return "none";
    }
  }
  if (!hidden) {
    /* Sair: fecha o ecrã inteiro do navegador se estiver ativo (qualquer modo). */
    if (browserFullscreenElement()) await setBrowserFullscreen(false);
    return "none";
  }
  if (!isInstalledTouchWebApp()) return "none";
  return (await setBrowserFullscreen(true)) ? "browser" : "none";
}
