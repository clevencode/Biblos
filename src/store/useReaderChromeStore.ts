/**
 * Chrome do leitor (hub pill / topbar) — estado atómico para o shell
 * sem forçar re-render de toda a árvore do App via props intermediárias.
 */

import { create } from "zustand";

type ReaderChromeState = {
  /** Leitura imersiva: navbar/hub dimmed ou ocultos. */
  chromeHidden: boolean;
  setChromeHidden: (hidden: boolean) => void;
};

export const useReaderChromeStore = create<ReaderChromeState>((set) => ({
  chromeHidden: false,
  setChromeHidden: (chromeHidden) => set({ chromeHidden }),
}));
