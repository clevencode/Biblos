/**
 * Flashcards : overrides locaux + sync Firestore (users/{uid}/private/state).
 * Plus d’écriture Notion depuis l’app.
 */
import type { Flashcard } from "./types";

export type { CardOverride, FlashcardOutboxItem } from "./cardOverrides";
export {
  notifyFlashcardRevision,
  subscribeFlashcardRevision,
  clearDirty,
  loadOverride,
  saveOverride,
  applyRemoteOverride,
  mergeCard,
  applyCardMark,
  archiveCardLearning,
  restartCardLearning,
  listOutbox,
  upsertOutbox,
  removeOutbox,
} from "./cardOverrides";

export type SyncState = "idle" | "saving" | "saved" | "error";

/** No-op conservé pour l’API de flashcardSession — persistance locale uniquement. */
export async function syncFlashcard(_input: {
  url: string;
  lembrete: string | null;
  categoria: Flashcard["categoria"];
  status: Flashcard["status"];
  id?: string;
}): Promise<{ ok: boolean; queued?: boolean; localOnly?: boolean; error?: string }> {
  return { ok: true, localOnly: true };
}
