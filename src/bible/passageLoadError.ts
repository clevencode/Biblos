export type PassageLoadErrorKind = "generic" | "offline_not_cached";

export function classifyPassageLoadError(
  message: string | null | undefined,
  options?: { offline?: boolean; offlineIndexReady?: boolean },
): PassageLoadErrorKind {
  const text = String(message || "").toLowerCase();
  if (!text) return "generic";

  const offlineHint =
    options?.offline === true ||
    text.includes("hors ligne") ||
    text.includes("offline") ||
    text.includes("cache local") ||
    text.includes("sans cache");

  const notCached =
    text.includes("non disponible") ||
    text.includes("indisponible") ||
    text.includes("introuvable") ||
    text.includes("not available");

  if (offlineHint && !options?.offlineIndexReady && notCached) {
    return "offline_not_cached";
  }

  if (offlineHint && !options?.offlineIndexReady) {
    return "offline_not_cached";
  }

  return "generic";
}
