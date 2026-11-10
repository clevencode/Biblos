import { Capacitor } from "@capacitor/core";
import "./typography/fonts";
import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppReadinessProvider } from "./context/AppReadinessContext";
import { SkeletonTheme } from "./skeleton";
import { ensureBibleIndexedFromBundle } from "./bibleEngine";
import { ensureCleanSlate } from "./cleanSlate";
import { syncNativeChrome } from "./nativeChrome";
import { scheduleIdle } from "./scheduleIdle";
import { applyTheme } from "./theme";
import "./skeleton/skeleton.css";
import "./index.css";

void syncNativeChrome(applyTheme());

async function boot() {
  const reloading = await ensureCleanSlate();
  if (reloading) return;

  if (Capacitor.isNativePlatform()) {
    scheduleIdle(() => void ensureBibleIndexedFromBundle(), 8000);
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BootErrorBoundary>
        <SkeletonTheme>
          <AppReadinessProvider>
            <App />
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
