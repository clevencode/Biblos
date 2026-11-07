import { YvIcon } from "./YvIcon";
import type { CloudSyncSurface } from "../context/AppReadinessContext";

type BibleSyncIndicatorProps = {
  cloudSync: CloudSyncSurface;
  catalogOffline?: boolean;
};

export function BibleSyncIndicator({
  cloudSync,
  catalogOffline = false,
}: BibleSyncIndicatorProps) {
  const surface: CloudSyncSurface =
    catalogOffline && cloudSync !== "syncing" ? "offline" : cloudSync;

  if (surface === "idle") return null;

  const ariaLabel =
    surface === "syncing"
      ? "Synchronisation en cours"
      : surface === "synced"
        ? "Données synchronisées"
        : "Mode hors ligne — données locales";

  const icon =
    surface === "syncing"
      ? "cloud_sync"
      : surface === "synced"
        ? "cloud_done"
        : "cloud_off";

  return (
    <span
      className={`bible-yv-sync-indicator is-${surface}${surface === "syncing" ? " is-ambient" : ""}`}
      role="status"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="bible-yv-sync-indicator-dot" aria-hidden />
      <YvIcon name={icon} className="bible-yv-sync-indicator-icon" />
    </span>
  );
}
