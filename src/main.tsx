import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { ensureCleanSlate } from "./cleanSlate";
import { syncNativeChrome } from "./nativeChrome";
import { applyTheme } from "./theme";
import "./index.css";

void syncNativeChrome(applyTheme());

async function boot() {
  const reloading = await ensureCleanSlate();
  if (reloading) return;

  registerSW({ immediate: true });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BootErrorBoundary>
        <App />
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
            onClick={() => this.setState({ error: null })}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

void boot();
