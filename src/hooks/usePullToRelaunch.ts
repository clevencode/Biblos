import { useCallback, useEffect, useRef, useState } from "react";
import { flushUserDataPush } from "../features/user-sync";
import { applyPendingSwUpdate, getHasPendingSwUpdate } from "../swUpdateManager";

/** Distância (px, já com resistência) para relançar ao largar. */
export const PULL_RELAUNCH_THRESHOLD = 72;
/** Máximo que o indicador desce. */
const PULL_MAX = 112;
/** Resistência: o indicador anda metade do dedo. */
const PULL_RESISTANCE = 0.5;
/** Antes de recarregar, espera no máximo isto pelo envio das atividades. */
const FLUSH_TIMEOUT_MS = 1500;

/** Onde o gesto não começa (texto, sliders, painéis, diálogos, navbar). */
const EXCLUDED = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='slider']",
  "[role='dialog']",
  "[aria-modal='true']",
  "dialog",
  "[data-no-pull-relaunch]",
  ".top-floating-sheet",
  ".bible-verse-actions",
  ".mode-tabs",
  ".radial-ui-backdrop",
].join(",");

export type PullRelaunchPhase = "idle" | "pulling" | "armed" | "relaunching";

function scrollParent(el: Element | null): HTMLElement | null {
  let node: Element | null = el;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement) {
      const { overflowY } = getComputedStyle(node);
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

/** Recarrega a app sem perder nada: envia atividades e aplica update pendente. */
export async function relaunchApp(): Promise<void> {
  await Promise.race([
    flushUserDataPush().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
  ]);
  if (getHasPendingSwUpdate() && (await applyPendingSwUpdate())) return;
  window.location.reload();
}

/**
 * Puxar para relançar — o mesmo gesto no navegador, na PWA instalada e no
 * APK (nenhum deles o oferece com o scroll em contentores internos).
 * Começa só com o conteúdo no topo e um arrasto vertical para baixo.
 */
export function usePullToRelaunch() {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<PullRelaunchPhase>("idle");
  const gesture = useRef<{
    x0: number;
    y0: number;
    scroller: HTMLElement | null;
    engaged: boolean;
    armed: boolean;
  } | null>(null);
  const relaunching = useRef(false);

  const reset = useCallback(() => {
    gesture.current = null;
    setPull(0);
    setPhase("idle");
  }, []);

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      if (relaunching.current || event.touches.length !== 1) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(EXCLUDED)) return;
      const scroller = scrollParent(target);
      if (scroller && scroller.scrollTop > 0) return;
      const touch = event.touches[0]!;
      gesture.current = {
        x0: touch.clientX,
        y0: touch.clientY,
        scroller,
        engaged: false,
        armed: false,
      };
    };

    const onMove = (event: TouchEvent) => {
      const g = gesture.current;
      if (!g || event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const dx = touch.clientX - g.x0;
      const dy = touch.clientY - g.y0;
      if (!g.engaged) {
        if (dy < -4 || Math.abs(dx) > 12 || (g.scroller && g.scroller.scrollTop > 0)) {
          gesture.current = null;
          return;
        }
        if (dy < 10 || dy < Math.abs(dx) * 1.5) return;
        g.engaged = true;
        g.y0 = touch.clientY - 10;
      }
      if (event.cancelable) event.preventDefault();
      const distance = Math.min(PULL_MAX, Math.max(0, (touch.clientY - g.y0) * PULL_RESISTANCE));
      const armed = distance >= PULL_RELAUNCH_THRESHOLD;
      if (armed && !g.armed) navigator.vibrate?.(10);
      g.armed = armed;
      setPull(distance);
      setPhase(armed ? "armed" : "pulling");
    };

    const onEnd = () => {
      const g = gesture.current;
      if (!g) return;
      if (!g.engaged || !g.armed) {
        reset();
        return;
      }
      gesture.current = null;
      relaunching.current = true;
      setPull(PULL_RELAUNCH_THRESHOLD);
      setPhase("relaunching");
      void relaunchApp();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", reset);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", reset);
    };
  }, [reset]);

  return { pull, phase };
}
