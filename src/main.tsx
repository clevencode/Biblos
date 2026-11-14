import "./typography/fonts";
import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppReadinessProvider } from "./context/AppReadinessContext";
import { UiLocaleProvider } from "./i18n/UiLocaleContext";
import { SkeletonTheme } from "./skeleton";
import {
  bootReadingPlansFirestore,
  isReadingPlansFirebaseConfigured,
} from "./features/reading-plans";
import { ConsumerAuthProvider } from "./features/consumer-auth";
import { ensureCleanSlate } from "./cleanSlate";
import { syncNativeChrome } from "./nativeChrome";
import { scheduleIdle } from "./scheduleIdle";
import { applyTheme } from "./theme";
import { bootPassageBarPanelLayout } from "./bible/passageBarPanelLayout";
import { bootPassagePillLayoutTest } from "./bible/passagePillLayout";
import { bootUiColortest } from "./ui/colortest";
import { requestPersistentStorage } from "./offlineStorageGuard";
import { bootSwUpdateManager } from "./swUpdateManager";
import {
  hydratePrefsMirror,
  markPrefsMirrorReady,
  STORAGE_PREF_KEY_LIST,
} from "./services/storage/StorageAdapter";
import "./skeleton/skeleton.css";
import "./editorial-admin.css";
import "./index.css";

bootUiColortest();
bootPassagePillLayoutTest();
bootPassageBarPanelLayout();

async function boot() {
  await ensureCleanSlate();
  await hydratePrefsMirror(STORAGE_PREF_KEY_LIST);
  markPrefsMirrorReady();

  void syncNativeChrome(applyTheme());
  void requestPersistentStorage();
  void bootSwUpdateManager();

  if (isReadingPlansFirebaseConfigured()) {
    scheduleIdle(() => void bootReadingPlansFirestore(), 1200);
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BootErrorBoundary>
        <SkeletonTheme>
          <AppReadinessProvider>
            <ConsumerAuthProvider>
              <UiLocaleProvider>
                <App />
              </UiLocaleProvider>
            </ConsumerAuthProvider>
          </AppReadinessProvider>
        </SkeletonTheme>
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
      return (
        <div className="boot-shell" role="alert">
          <p className="boot-brand">Biblos</p>
          <p className="boot-muted">Une erreur est survenue</p>
          <p className="muted" style={{ maxWidth: "28rem", margin: "8px auto 0", fontSize: "0.85rem" }}>
            {this.state.error.message}
          </p>
          <button
            type="button"
            style={{
              marginTop: 16,
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#0d1117",
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
