/**
 * Registo canónico das atividades do utilizador sincronizadas no Firestore.
 *
 * Cada store local (localStorage / Preferences) declara aqui, num só formato:
 * documento remoto, export, merge do remoto, subscrição de mudanças e limpeza.
 * O motor (`userDataSync`) itera este registo — nenhuma atividade é ligada à mão.
 *
 * Nunca textos bíblicos: só dados pessoais (marcas, notas, planos, histórico).
 */

import {
  clearActivityStore,
  exportActivityStore,
  importActivityStore,
  subscribeActivity,
  type ActivityStore,
} from "../../../activityLog";
import {
  clearVerseNoteStore,
  exportVerseNoteStore,
  importVerseNoteStore,
  subscribeVerseNotes,
} from "../../../bible/verseNotes";
import {
  clearVerseMarkStore,
  exportVerseMarkRemoved,
  exportVerseMarkStore,
  exportVerseMarkTouched,
  importVerseMarkStore,
  subscribeVerseMarksRevision,
} from "../../../verseMarks";
import {
  clearDayNoteStore,
  exportDayNoteStore,
  importDayNoteStore,
  subscribeDayNotes,
} from "../../reading-plans/domain/planDayNote";
import {
  clearPlanProgressStore,
  exportPlanProgressStore,
  importPlanProgressStore,
  subscribePlanProgress,
} from "../../reading-plans/domain/planProgress";
import {
  userActivityDoc,
  userHighlightsDoc,
  userNotesDoc,
  userPlanProgressDoc,
  userVerseNotesDoc,
} from "./userDataPaths";

export type SyncedStoreId =
  | "highlights"
  | "notes"
  | "verseNotes"
  | "planProgress"
  | "activity";

/** Campos gravados no documento (além de `updatedAt`). */
export type SyncedPayload = Record<string, unknown>;

export type SyncedStore = {
  id: SyncedStoreId;
  docPath: (uid: string) => string;
  /** Estado local → campos do documento. */
  exportLocal: () => SyncedPayload;
  /** Sem dados úteis (não semear / não sobrescrever remoto). */
  isEmpty: (payload: SyncedPayload | undefined) => boolean;
  /** Funde o documento remoto no local; `true` se o local mudou. */
  mergeRemote: (data: SyncedPayload) => boolean;
  /** Mudança local (gesto do utilizador ou outra aba). */
  subscribe: (onChange: () => void) => () => void;
  clearLocal: () => void;
};

function isEmptyMap(value: unknown): boolean {
  if (value == null || typeof value !== "object") return true;
  return Object.keys(value as Record<string, unknown>).length === 0;
}

function storeMapIsEmpty(payload: SyncedPayload | undefined): boolean {
  return isEmptyMap(payload?.store);
}

/** Store simples `{ store }` com merge `import(store, true)`. */
function mapStore(input: {
  id: SyncedStoreId;
  docPath: (uid: string) => string;
  exportStore: () => unknown;
  importStore: (store: never, merge: boolean) => boolean;
  subscribe: (onChange: () => void) => () => void;
  clearLocal: () => void;
}): SyncedStore {
  return {
    id: input.id,
    docPath: input.docPath,
    exportLocal: () => ({ store: input.exportStore() }),
    isEmpty: storeMapIsEmpty,
    mergeRemote: (data) =>
      input.importStore((data.store ?? {}) as never, true),
    subscribe: input.subscribe,
    clearLocal: input.clearLocal,
  };
}

export const SYNCED_STORES: readonly SyncedStore[] = [
  {
    id: "highlights",
    docPath: userHighlightsDoc,
    exportLocal: () => ({
      store: exportVerseMarkStore(),
      touched: exportVerseMarkTouched(),
      removed: exportVerseMarkRemoved(),
    }),
    /* Tombstones (`removed`) também contam: apagar marcas tem de sincronizar. */
    isEmpty: (payload) =>
      storeMapIsEmpty(payload) && isEmptyMap(payload?.removed),
    mergeRemote: (data) =>
      importVerseMarkStore(
        (data.store ?? {}) as Parameters<typeof importVerseMarkStore>[0],
        (data.touched ?? {}) as Parameters<typeof importVerseMarkStore>[1],
        (data.removed ?? {}) as Parameters<typeof importVerseMarkStore>[2],
        true,
      ),
    subscribe: subscribeVerseMarksRevision,
    clearLocal: clearVerseMarkStore,
  },
  mapStore({
    id: "notes",
    docPath: userNotesDoc,
    exportStore: exportDayNoteStore,
    importStore: importDayNoteStore,
    subscribe: subscribeDayNotes,
    clearLocal: clearDayNoteStore,
  }),
  mapStore({
    id: "verseNotes",
    docPath: userVerseNotesDoc,
    exportStore: exportVerseNoteStore,
    importStore: importVerseNoteStore,
    subscribe: subscribeVerseNotes,
    clearLocal: clearVerseNoteStore,
  }),
  mapStore({
    id: "planProgress",
    docPath: userPlanProgressDoc,
    exportStore: exportPlanProgressStore,
    importStore: importPlanProgressStore,
    subscribe: subscribePlanProgress,
    clearLocal: clearPlanProgressStore,
  }),
  {
    id: "activity",
    docPath: userActivityDoc,
    exportLocal: () => ({ store: exportActivityStore() }),
    isEmpty: (payload) => {
      const events = (payload?.store as ActivityStore | undefined)?.events;
      return !Array.isArray(events) || events.length === 0;
    },
    mergeRemote: (data) =>
      importActivityStore(
        (data.store ?? { events: [] }) as ActivityStore,
        true,
      ),
    subscribe: subscribeActivity,
    clearLocal: clearActivityStore,
  },
];

export function syncedStoreById(id: SyncedStoreId): SyncedStore | undefined {
  return SYNCED_STORES.find((store) => store.id === id);
}

export function isSyncedStoreId(value: unknown): value is SyncedStoreId {
  return SYNCED_STORES.some((store) => store.id === value);
}
