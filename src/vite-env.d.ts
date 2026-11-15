/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

declare module "virtual:pwa-register" {
  export type RegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisterError?: (error: unknown) => void;
  };

  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>;
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_WEB_CLIENT_ID?: string;
  readonly VITE_CLEVENCODE_ADMIN_EMAIL?: string;
  /** `test` (default) = sem passo versículo após capítulo; `legacy` = grelha Verset */
  readonly VITE_PASSAGE_PICKER_FLOW?: string;
  /** `test` (default) = chevrons na barra capítulo; `legacy` = skip_previous / skip_next */
  readonly VITE_PASSAGE_BAR_SKIP_ICONS?: string;
  /** `test` (default) = barra compacta (altura título); `legacy` = barra touch 44px */
  readonly VITE_PASSAGE_BAR_PANEL_LAYOUT?: string;
  /** `test` (default) = pill livro+capítulo; `legacy` = dois chips */
  readonly VITE_PASSAGE_PILL?: string;
  /** `test` (default) = pill só livros; ícone search = palavras */
  readonly VITE_PASSAGE_DISCOVERY_FLOW?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
