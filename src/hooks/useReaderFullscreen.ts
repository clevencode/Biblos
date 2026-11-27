import { useCallback, useEffect } from "react";
import { useReaderChromeStore } from "../store/useReaderChromeStore";

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function documentFullscreenElement(): Element | null {
  const doc = document as WebkitDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function documentFullscreenSupported(): boolean {
  const doc = document as WebkitDocument;
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

async function enterDocumentFullscreen() {
  if (!documentFullscreenSupported() || documentFullscreenElement()) return;
  const root = document.documentElement as WebkitElement;
  try {
    await (root.requestFullscreen?.({ navigationUI: "hide" }) ??
      root.webkitRequestFullscreen?.());
  } catch {
    /* Recusado (gesto/permissão): o modo do leitor segue sem API nativa. */
  }
}

async function exitDocumentFullscreen() {
  if (!documentFullscreenElement()) return;
  const doc = document as WebkitDocument;
  try {
    await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
  } catch {
    /* Já saiu. */
  }
}

/**
 * Modo tela cheia do leitor: oculta topbar, navbar e play (CSS via
 * `html[data-reader-fullscreen]`) e, quando o browser suporta, pede a
 * Fullscreen API. Sair da tela cheia nativa (Esc / gesto) sai do modo.
 *
 * Montar uma única vez (AppShellNav) — é dono do atributo no `<html>`.
 */
export function useReaderFullscreen(enabled: boolean) {
  const active = useReaderChromeStore((s) => s.fullscreen);
  const setActive = useReaderChromeStore((s) => s.setFullscreen);

  const enter = useCallback(() => {
    setActive(true);
    void enterDocumentFullscreen();
  }, [setActive]);

  const exit = useCallback(() => {
    setActive(false);
    void exitDocumentFullscreen();
  }, [setActive]);

  /* Saída nativa (Esc, gesto do sistema) → sai do modo do leitor. */
  useEffect(() => {
    const sync = () => {
      if (!documentFullscreenElement()) setActive(false);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [setActive]);

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

  return { active, enter, exit };
}
