import type { BibleTextVersionId } from "./bibleVersions";
import {
  getOfflineMeta,
  isOfflineBibleReady,
  OFFLINE_BOOK_TOTAL,
} from "../bibleOffline";
import {
  getHt1998OfflineMeta,
  isHt1998OfflineReady,
} from "./ht1998Offline";

export type VersionAvailabilityState =
  | { status: "not_downloaded" }
  | { status: "downloading"; progressPercent: number }
  | { status: "offline_ready"; verseCount: number; updatedAt: number }
  | {
      status: "error";
      reason: "network_failed" | "storage_full" | "invalid_data";
    };

export type VersionDownloadProgress = {
  done: number;
  total: number;
};

/** Estado em curso de download (memória de sessão). */
const downloadingByVersion = new Map<
  BibleTextVersionId,
  VersionDownloadProgress
>();

const lastErrorByVersion = new Map<
  BibleTextVersionId,
  VersionAvailabilityState & { status: "error" }
>();

export function setVersionDownloadProgress(
  versionId: BibleTextVersionId,
  progress: VersionDownloadProgress | null,
): void {
  if (!progress || progress.total <= 0) {
    downloadingByVersion.delete(versionId);
    return;
  }
  downloadingByVersion.set(versionId, progress);
  lastErrorByVersion.delete(versionId);
}

export function clearVersionDownloadProgress(versionId: BibleTextVersionId): void {
  downloadingByVersion.delete(versionId);
}

export function setVersionAvailabilityError(
  versionId: BibleTextVersionId,
  reason: "network_failed" | "storage_full" | "invalid_data",
): void {
  downloadingByVersion.delete(versionId);
  lastErrorByVersion.set(versionId, { status: "error", reason });
}

export function clearVersionAvailabilityError(versionId: BibleTextVersionId): void {
  lastErrorByVersion.delete(versionId);
}

export function classifyOfflineDownloadError(
  err: unknown,
): "network_failed" | "storage_full" | "invalid_data" {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "network_failed";
  }
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("quota") ||
    lower.includes("stockage insuffisant") ||
    lower.includes("storage")
  ) {
    return "storage_full";
  }
  if (
    lower.includes("invalide") ||
    lower.includes("invalid") ||
    lower.includes("vide") ||
    lower.includes("incomplet")
  ) {
    return "invalid_data";
  }
  return "network_failed";
}

export async function resolveVersionAvailability(
  versionId: BibleTextVersionId,
): Promise<VersionAvailabilityState> {
  const downloading = downloadingByVersion.get(versionId);
  if (downloading && downloading.total > 0) {
    const progressPercent = Math.min(
      100,
      Math.round((downloading.done / downloading.total) * 100),
    );
    return { status: "downloading", progressPercent };
  }

  const error = lastErrorByVersion.get(versionId);
  if (error) return error;

  if (versionId === "ht98") {
    const ready = await isHt1998OfflineReady();
    if (!ready) return { status: "not_downloaded" };
    const meta = await getHt1998OfflineMeta();
    return {
      status: "offline_ready",
      verseCount: OFFLINE_BOOK_TOTAL,
      updatedAt: meta?.at ?? Date.now(),
    };
  }

  const ready = await isOfflineBibleReady();
  if (!ready) return { status: "not_downloaded" };
  const meta = await getOfflineMeta();
  return {
    status: "offline_ready",
    verseCount: meta?.count ?? OFFLINE_BOOK_TOTAL,
    updatedAt: meta?.at ?? Date.now(),
  };
}

export function versionAvailabilityLabel(state: VersionAvailabilityState): string {
  if (state.status === "offline_ready") return "Disponible hors ligne";
  if (state.status === "downloading") {
    return `Téléchargement… ${state.progressPercent}%`;
  }
  if (state.status === "error") {
    if (state.reason === "storage_full") return "Espace de stockage insuffisant";
    if (state.reason === "invalid_data") return "Données invalides";
    return "Échec réseau";
  }
  return "Non téléchargée";
}
