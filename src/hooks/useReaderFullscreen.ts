import { Capacitor } from "@capacitor/core";
import { Animation, StatusBar } from "@capacitor/status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReaderChromeStore } from "../store/useReaderChromeStore";

/** Duração da transição do chrome (ver CSS `data-reader-fs-anim`). */
const CHROME_ANIM_MS = 420;
/** Quanto tempo o aviso « como sair » fica visível. */
const HINT_MS = 2800;

/** Nativo (APK): esconde/mostra a barra de estado — sem aviso do sistema. */
async function setNativeImmersive(on: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (on) await StatusBar.hide({ animation: Animation.Fade });
    else await StatusBar.show({ animation: Animation.Fade });
  } catch {
    /* plugin indisponível: o modo do leitor segue só com CSS */
  }
}

/**
 * Modo tela cheia do leitor: oculta topbar, navbar, play e skips
 * (CSS via `html[data-reader-fullscreen]`) com transição suave.
 *
 * Não usa a Fullscreen API do navegador — ela impõe o aviso nativo
 * (« Prima Esc para sair… »), que não pode ser personalizado. Em vez
 * disso mostra um aviso próprio (`hintVisible`) e sai com Esc.
 *
 * Montar uma única vez (AppShellNav) — é dono dos atributos no `<html>`.
 */
export function useReaderFullscreen(enabled: boolean) {
  const active = useReaderChromeStore((s) => s.fullscreen);
  const setActive = useReaderChromeStore((s) => s.setFullscreen);
  const [hintVisible, setHintVisible] = useState(false);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Marca a janela de animação (enter e exit usam a mesma transição). */
  const pulseChromeAnim = useCallback(() => {
    const root = document.documentElement;
    root.dataset.readerFsAnim = "true";
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => {
      delete root.dataset.readerFsAnim;
      animTimer.current = null;
    }, CHROME_ANIM_MS);
  }, []);

  const hideHint = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = null;
    setHintVisible(false);
  }, []);

  const enter = useCallback(() => {
    pulseChromeAnim();
    setActive(true);
    void setNativeImmersive(true);
    setHintVisible(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => {
      setHintVisible(false);
      hintTimer.current = null;
    }, HINT_MS);
  }, [pulseChromeAnim, setActive]);

  const exit = useCallback(() => {
    pulseChromeAnim();
    setActive(false);
    hideHint();
    void setNativeImmersive(false);
  }, [hideHint, pulseChromeAnim, setActive]);

  /* Esc sai do modo (o atalho que o aviso nativo ensinava). */
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exit]);

  /* Fora do leitor (outra aba / overlay): não fica preso em tela cheia. */
  useEffect(() => {
    if (!enabled && active) exit();
  }, [enabled, active, exit]);

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.readerFullscreen = "true";
    else delete root.dataset.readerFullscreen;
    return () => {
      delete root.dataset.readerFullscreen;
    };
  }, [active]);

  useEffect(
    () => () => {
      if (animTimer.current) clearTimeout(animTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      delete document.documentElement.dataset.readerFsAnim;
    },
    [],
  );

  return { active, enter, exit, hintVisible, hideHint };
}
