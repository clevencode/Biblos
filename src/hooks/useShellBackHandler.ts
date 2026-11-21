import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { isShellRadialOpen, setShellRadialOpen } from "../shellRadial";
import { requestReaderShellBack } from "../shellBackStack";

export type ShellBackHandlerOptions = {
  accountOpen: boolean;
  onCloseAccount: () => void;
  hasPlanReading: boolean;
  onReturnFromPlanReading: () => void;
  hasWorkspacePlan: boolean;
  onLeaveWorkspace: () => void;
};

function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Prioridade de negócio: radial → overlays leitor → conta → leitura plano → workspace.
 * Android: @capacitor/app backButton. Web: Escape (fora de inputs).
 */
export function useShellBackHandler(options: ShellBackHandlerOptions): void {
  const {
    accountOpen,
    onCloseAccount,
    hasPlanReading,
    onReturnFromPlanReading,
    hasWorkspacePlan,
    onLeaveWorkspace,
  } = options;

  useEffect(() => {
    function handleBack(): boolean {
      if (isShellRadialOpen()) {
        setShellRadialOpen(false);
        return true;
      }
      if (requestReaderShellBack()) return true;
      if (accountOpen) {
        onCloseAccount();
        return true;
      }
      if (hasPlanReading) {
        onReturnFromPlanReading();
        return true;
      }
      if (hasWorkspacePlan) {
        onLeaveWorkspace();
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
    }

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown, true);
      removeNative?.();
    };
  }, [
    accountOpen,
    onCloseAccount,
    hasPlanReading,
    onReturnFromPlanReading,
    hasWorkspacePlan,
    onLeaveWorkspace,
  ]);
}
