/**
 * Pressão longa numa palavra do texto bíblico → callback com a palavra.
 *
 * Listeners delegados no contentor (os versículos não re-renderizam). O toque
 * curto continua a selecionar o versículo; depois de uma pressão longa, o
 * `click` que o browser emite ao levantar o dedo é travado em fase de captura,
 * antes de chegar ao onClick do versículo (React escuta na raiz, em bolha).
 */

import { useEffect, useRef, type RefObject } from "react";
import { wordAtPoint, type WordAtPoint } from "../bible/wordAtPoint";

export const WORD_LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;
const HIGHLIGHT_NAME = "dict-word";

type HighlightRegistry = {
  set: (name: string, value: unknown) => void;
  delete: (name: string) => void;
};

function highlights(): HighlightRegistry | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  const Ctor = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  return css?.highlights && Ctor ? css.highlights : null;
}

/** Realça a palavra tocada (CSS Custom Highlight API; sem suporte → nada). */
export function highlightDictWord(range: Range | null): void {
  const reg = highlights();
  if (!reg) return;
  if (!range) {
    reg.delete(HIGHLIGHT_NAME);
    return;
  }
  const Ctor = (globalThis as unknown as { Highlight: new (...ranges: Range[]) => unknown }).Highlight;
  reg.set(HIGHLIGHT_NAME, new Ctor(range));
}

export function useWordLongPress(
  containerRef: RefObject<HTMLElement | null>,
  options: { enabled: boolean; onWord: (hit: WordAtPoint) => void },
): void {
  const onWordRef = useRef(options.onWord);
  onWordRef.current = options.onWord;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !options.enabled) return;

    let timer: number | null = null;
    let start: { x: number; y: number; id: number } | null = null;
    let swallowClickUntil = 0;

    const cancel = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = null;
      start = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (!(e.target instanceof Element) || !e.target.closest(".bible-verse-text")) return;
      cancel();
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      timer = window.setTimeout(() => {
        const at = start;
        timer = null;
        if (!at) return;
        const hit = wordAtPoint(at.x, at.y);
        if (!hit) return;
        swallowClickUntil = Date.now() + 800;
        window.getSelection?.()?.removeAllRanges();
        highlightDictWord(hit.range);
        onWordRef.current(hit);
      }, WORD_LONG_PRESS_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
    };

    const onClickCapture = (e: MouseEvent) => {
      if (Date.now() > swallowClickUntil) return;
      swallowClickUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    };

    const onContextMenu = (e: Event) => {
      if (e.target instanceof Element && e.target.closest(".bible-verse-text")) {
        e.preventDefault();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("scroll", cancel, { passive: true, capture: true });
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      cancel();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", cancel);
      el.removeEventListener("pointercancel", cancel);
      el.removeEventListener("pointerleave", cancel);
      el.removeEventListener("scroll", cancel, { capture: true });
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [containerRef, options.enabled]);
}
