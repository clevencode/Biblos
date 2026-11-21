import type { BibleTextVersionId } from "./bibleVersions";

/** Pedido de sheet a abrir após fechar o painel de conta. */
export type ProfileOverlayRequest = "history" | "marks";

export type BibleFontFamily = "serif" | "sans";

/** Snapshot de leitura exposto ao perfil (versão / offline / tipografia). */
export type ProfileReadingChrome = {
  textVersion: BibleTextVersionId;
  htCatalogLoading: boolean;
  htCatalogError: string | null;
  versionOfflineReady: boolean;
  offlineBusy: boolean;
  offlineProgress: { done: number; total: number } | null;
  /** S21 com bundle local — esconder controlo offline. */
  offlineHidden: boolean;
  fontSize: number;
  fontFamily: BibleFontFamily;
  fontMin: number;
  fontMax: number;
  switchTextVersion: (id: BibleTextVersionId) => void;
  toggleOfflineBible: () => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: BibleFontFamily) => void;
  bumpFontSize: (delta: number) => void;
};
