import "./typography/fonts";
import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppReadinessProvider } from "./context/AppReadinessContext";
import { UiLocaleProvider } from "./i18n/UiLocaleContext";
import {
  bootReadingPlansFirestore,
  isReadingPlansFirebaseConfigured,
} from "./features/reading-plans";
import { ConsumerAuthProvider } from "./features/consumer-auth";
import { ensureCleanSlate } from "./cleanSlate";
import { scheduleIdle } from "./scheduleIdle";
import { applyTheme } from "./theme";
import { bootPassageBarPanelLayout } from "./bible/passageBarPanelLayout";
import { bootPassagePillLayoutTest } from "./bible/passagePillLayout";
import { bootUiColortest } from "./ui/colortest";
import { bootKeyboardInsets } from "./ui/keyboardInsets";
import { requestPersistentStorage } from "./offlineStorageGuard";
import { bootSwUpdateManager } from "./swUpdateManager";
import {
  hydratePrefsMirror,
  markPrefsMirrorReady,
  STORAGE_PREF_KEY_LIST,
} from "./services/storage/StorageAdapter";
import "./editorial-admin.css";
import "./index.css";

bootUiColortest();
bootPassagePillLayoutTest();
bootPassageBarPanelLayout();
bootKeyboardInsets();

async function boot() {
  /* Splash nativa fica até AppReadiness (shell + 2 rAF) — anti-CLS no relançamento. */
  await ensureCleanSlate();
  await hydratePrefsMirror(STORAGE_PREF_KEY_LIST);
  markPrefsMirrorReady();

  applyTheme();
  void requestPersistentStorage();
  void bootSwUpdateManager();

  if (isReadingPlansFirebaseConfigured()) {
    scheduleIdle(() => void bootReadingPlansFirestore(), 1200);
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BootErrorBoundary>
        <AppReadinessProvider>
          <ConsumerAuthProvider>
            <UiLocaleProvider>
              <App />
            </UiLocaleProvider>
          </ConsumerAuthProvider>
        </AppReadinessProvider>
      </BootErrorBoundary>
    </StrictMode>,
  );
}

class BootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[biblos]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const dark =
        typeof document !== "undefined" &&
        document.documentElement.dataset.theme !== "light";
      return (
        <div
          role="alert"
          style={{
            margin: 0,
            minHeight: "100%",
            display: "grid",
            placeContent: "center",
            gap: 6,
            padding: 24,
            textAlign: "center",
            fontFamily: 'Outfit, "Avenir Next", "Segoe UI", sans-serif',
            background: dark ? "#0d1117" : "#ffffff",
            color: dark ? "#ffffff" : "#0d1117",
          }}
        >
          <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
            Biblos
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              opacity: 0.7,
            }}
          >
            Une erreur est survenue
          </p>
          <p
            style={{
              maxWidth: "28rem",
              margin: "8px auto 0",
              fontSize: "0.85rem",
              opacity: 0.55,
            }}
          >
            {this.state.error.message}
          </p>
          <button
            type="button"
            style={{
              marginTop: 16,
              justifySelf: "center",
              padding: "10px 16px",
              borderRadius: 10,
              border: dark ? "1px solid #374151" : "1px solid #d1d5db",
              background: dark ? "#1f2937" : "#fff",
              color: dark ? "#f9fafb" : "#0d1117",
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => window.location.reload()}
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

void boot();
