import type { BibleTextVersionId } from "./bibleVersions";

/** Pedido de sheet a abrir após fechar o painel de conta. */
export type ProfileOverlayRequest = "history" | "marks";

/** Snapshot de leitura exposto ao perfil (versão / offline). */
export type ProfileReadingChrome = {
  textVersion: BibleTextVersionId;
  htCatalogLoading: boolean;
  htCatalogError: string | null;
  versionOfflineReady: boolean;
  offlineBusy: boolean;
  offlineProgress: { done: number; total: number } | null;
  /** S21 com bundle local — esconder controlo offline. */
  offlineHidden: boolean;
  switchTextVersion: (id: BibleTextVersionId) => void;
  toggleOfflineBible: () => void;
};
