import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { syncNativeChrome } from "./nativeChrome";
import "./index.css";

void syncNativeChrome();

registerSW({ immediate: true });

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
          <p className="boot-muted">Erreur au démarrage</p>
          <p className="muted" style={{ maxWidth: "28rem", margin: "8px auto 0", fontSize: "0.85rem" }}>
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BootErrorBoundary>
      <App />
    </BootErrorBoundary>
  </StrictMode>,
);
