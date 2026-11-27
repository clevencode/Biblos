import { useCallback, useEffect, useRef, useState } from "react";
import { setSystemBarsHidden } from "../native/immersiveMode";
import { useReaderChromeStore } from "../store/useReaderChromeStore";

/** Duração da transição do chrome (ver CSS `data-reader-fs-anim`). */
const CHROME_ANIM_MS = 420;
/** Quanto tempo o aviso « como sair » fica visível. */
const HINT_MS = 2800;

/**
 * Modo tela cheia do leitor: oculta topbar, navbar, play e skips
 * (CSS via `html[data-reader-fullscreen]`) com transição suave.
 *
 * Nunca usa a Fullscreen API do navegador: ela impõe o aviso do Chrome
 * (« <domínio> - Faites glisser… »), que não é personalizável. Mostra sempre
 * o aviso próprio (`hintVisible`). Barras do sistema: só no APK (plugin
 * nativo). Esc e « voltar » saem via `useShellBackHandler` (1.ª prioridade).
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

  const showHint = useCallback(() => {
    setHintVisible(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => {
      setHintVisible(false);
      hintTimer.current = null;
    }, HINT_MS);
  }, []);

  /*
   * Entrar/sair = só mudar o estado. Os efeitos (animação, barras do
   * sistema, aviso) reagem à mudança — iguais venham do botão, de Esc,
   * do « voltar » do Android/navegador ou de sair do leitor.
   */
  const enter = useCallback(() => setActive(true), [setActive]);
  const exit = useCallback(() => setActive(false), [setActive]);

  const wasActive = useRef(active);
  useEffect(() => {
    const root = document.documentElement;
    if (wasActive.current !== active) {
      wasActive.current = active;
      pulseChromeAnim();
      /* APK: barras do sistema (estado + navegação) totalmente ocultas. */
      void setSystemBarsHidden(active);
      if (active) showHint();
      else hideHint();
    }
    if (active) root.dataset.readerFullscreen = "true";
    else delete root.dataset.readerFullscreen;
  }, [active, hideHint, pulseChromeAnim, showHint]);

  /* Fora do leitor (outra aba / overlay): não fica preso em tela cheia. */
  useEffect(() => {
    if (!enabled && active) exit();
  }, [enabled, active, exit]);

  useEffect(
    () => () => {
      if (animTimer.current) clearTimeout(animTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      delete document.documentElement.dataset.readerFsAnim;
      delete document.documentElement.dataset.readerFullscreen;
    },
    [],
  );

  return { active, enter, exit, hintVisible, hideHint };
}
