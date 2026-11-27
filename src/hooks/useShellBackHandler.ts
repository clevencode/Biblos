import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { isShellRadialOpen, setShellRadialOpen } from "../shellRadial";
import { requestReaderShellBack } from "../shellBackStack";
import { useReaderChromeStore } from "../store/useReaderChromeStore";

export type ShellBackHandlerOptions = {
  accountOpen: boolean;
  onCloseAccount: () => void;
  adminOpen?: boolean;
  onCloseAdmin?: () => void;
  hasPlanReading: boolean;
  onReturnFromPlanReading: () => void;
  hasWorkspacePlan: boolean;
  onLeaveWorkspace: () => void;
};

/** Marca da entrada de histórico que segura o « voltar » do navegador. */
const BACK_GUARD_KEY = "biblosBackGuard";

function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function hasBackGuard(): boolean {
  const state = window.history.state as Record<string, unknown> | null;
  return Boolean(state && state[BACK_GUARD_KEY]);
}

/**
 * Hash em que a guarda foi posta: um popstate com outro hash (ex. #admin)
 * é navegação, não « voltar ». A query pode mudar (link partilhado limpo).
 */
let guardHash: string | null = null;

function pushBackGuard(): void {
  const state = (window.history.state as Record<string, unknown> | null) ?? {};
  window.history.pushState({ ...state, [BACK_GUARD_KEY]: true }, "");
  guardHash = window.location.hash;
}

/**
 * « Voltar » único para app e navegador. Prioridade:
 * tela cheia → radial → overlays leitor → admin → conta → leitura plano →
 * workspace. Sem nada para fechar: APK sai da app; navegador recua no
 * histórico (sai da página) — como qualquer site.
 *
 * - Android (APK): `@capacitor/app` backButton.
 * - Navegador (Chrome mobile, desktop): gesto/botão voltar via `popstate`
 *   sobre uma entrada de guarda no histórico; Escape no teclado.
 */
export function useShellBackHandler(options: ShellBackHandlerOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    function handleBack(): boolean {
      const o = optionsRef.current;
      const chrome = useReaderChromeStore.getState();
      if (chrome.fullscreen) {
        chrome.setFullscreen(false);
        return true;
      }
      if (isShellRadialOpen()) {
        setShellRadialOpen(false);
        return true;
      }
      if (requestReaderShellBack()) return true;
      if (o.adminOpen) {
        o.onCloseAdmin?.();
        return true;
      }
      if (o.accountOpen) {
        o.onCloseAccount();
        return true;
      }
      if (o.hasPlanReading) {
        o.onReturnFromPlanReading();
        return true;
      }
      if (o.hasWorkspacePlan) {
        o.onLeaveWorkspace();
        return true;
      }
      return false;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isTextInputFocused()) return;
      if (!handleBack()) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);

    let cancelled = false;
    let removeNative: (() => void) | undefined;
    let removeWeb: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      void import("@capacitor/app").then(({ App }) => {
        if (cancelled) return;
        const pending = App.addListener("backButton", ({ canGoBack }) => {
          if (handleBack()) return;
          if (!canGoBack) {
            void App.exitApp();
          }
        });
        void Promise.resolve(pending).then((handle) => {
          if (cancelled) {
            void handle.remove();
            return;
          }
          removeNative = () => {
            void handle.remove();
          };
        });
      });
    } else {
      /*
       * Navegador: a entrada de guarda absorve o « voltar ». Se havia algo
       * para fechar, fecha e repõe a guarda; senão recua de verdade.
       */
      if (!hasBackGuard()) pushBackGuard();
      else guardHash = window.location.hash;
      const onPopState = () => {
        if (hasBackGuard()) return;
        /* Navegação por hash (ex. #admin) ou outro URL: não é o « voltar ». */
        if (window.location.hash !== guardHash) return;
        if (handleBack()) {
          pushBackGuard();
          return;
        }
        window.history.back();
      };
      window.addEventListener("popstate", onPopState);
      removeWeb = () => window.removeEventListener("popstate", onPopState);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown, true);
      removeNative?.();
      removeWeb?.();
    };
  }, []);
}
