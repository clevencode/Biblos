/**
 * Registo canónico das atividades do utilizador sincronizadas no Firestore.
 *
 * Cada store declara aqui, num só formato, como se lê e substitui como mapa
 * `chave → valor`. A fusão entre dispositivos (última alteração ganha,
 * remoções incluídas) é feita pelo motor, igual para todos.
 *
 * Nunca textos bíblicos: só dados pessoais (marcas, notas, planos, histórico).
 */

import {
  clearActivityStore,
  exportActivityStore,
  replaceActivityStore,
  subscribeActivity,
  type ActivityEvent,
} from "../../../activityLog";
import {
  clearVerseNoteStore,
  exportVerseNoteStore,
  replaceVerseNoteStore,
  subscribeVerseNotes,
  type VerseNoteStore,
} from "../../../bible/verseNotes";
import {
  clearVerseMarkStore,
  dropLegacyVerseMarkRemovals,
  exportVerseMarkEntries,
  readLegacyVerseMarkRemovals,
  replaceVerseMarkEntries,
  subscribeVerseMarksRevision,
  type VerseMarkEntry,
} from "../../../verseMarks";
import {
  clearDayNoteStore,
  exportDayNoteStore,
  replaceDayNoteStore,
  subscribeDayNotes,
  type DayNoteStore,
} from "../../reading-plans/domain/planDayNote";
import {
  clearPlanProgressStore,
  exportPlanProgressStore,
  replacePlanProgressStore,
  subscribePlanProgress,
  type PlanProgress,
  type PlanProgressStore,
} from "../../reading-plans/domain/planProgress";
import { metaFromTimes, type Entries, type MetaMap } from "./syncEntries";
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

export type SyncedStore = {
  id: SyncedStoreId;
  docPath: (uid: string) => string;
  /** Estado local como mapa `chave → valor`. */
  readEntries: () => Entries;
  /** Substitui o estado local (resultado da fusão). */
  writeEntries: (entries: Entries) => void;
  /** Mudança local (gesto do utilizador ou outra aba). */
  subscribe: (onChange: () => void) => () => void;
  clearLocal: () => void;
  /**
   * 1.ª execução (sem meta): data de entradas que já existiam e remoções
   * guardadas pelo formato antigo. Por omissão: sem data (perde para tudo).
   */
  migrateLocal?: {
    timeOf?: (key: string, value: unknown) => string | undefined;
    removed?: () => Record<string, string>;
    done?: () => void;
  };
  /** Documento remoto do formato antigo (`{ store, … }`) → entradas + meta. */
  legacyRemote: (data: Record<string, unknown>) => {
    entries: Entries;
    meta: MetaMap;
  };
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Notas: o próprio registo traz `updatedAt`. */
function noteStore(input: {
  id: SyncedStoreId;
  docPath: (uid: string) => string;
  read: () => Record<string, { updatedAt?: string }>;
  replace: (store: never) => void;
  subscribe: (onChange: () => void) => () => void;
  clearLocal: () => void;
}): SyncedStore {
  const timeOf = (_key: string, value: unknown) =>
    str((value as { updatedAt?: unknown } | null)?.updatedAt);
  return {
    id: input.id,
    docPath: input.docPath,
    readEntries: () => input.read() as Entries,
    writeEntries: (entries) => input.replace(entries as never),
    subscribe: input.subscribe,
    clearLocal: input.clearLocal,
    migrateLocal: { timeOf },
    legacyRemote: (data) => {
      const entries = objectOf(data.store);
      return { entries, meta: metaFromTimes(entries, timeOf) };
    },
  };
}

/**
 * Progresso de planos: uma chave por plano (`planId` → início / último dia)
 * e uma por dia concluído (`planId#dia`). Concluir dias em dois aparelhos
 * soma; reiniciar o plano remove os dias em todos.
 */
const PLAN_DAY_SEP = "#";

function planProgressToEntries(store: PlanProgressStore): Entries {
  const entries: Entries = {};
  for (const [planId, progress] of Object.entries(store)) {
    if (!progress || typeof progress !== "object") continue;
    entries[planId] = {
      startedAt: progress.startedAt,
      ...(typeof progress.lastJour === "number"
        ? { lastJour: progress.lastJour }
        : {}),
    };
    for (const jour of progress.completedJours ?? []) {
      entries[`${planId}${PLAN_DAY_SEP}${jour}`] = 1;
    }
  }
  return entries;
}

function planProgressFromEntries(entries: Entries): PlanProgressStore {
  const store: PlanProgressStore = {};
  const ensure = (planId: string): PlanProgress =>
    (store[planId] ??= {
      startedAt: new Date().toISOString(),
      completedJours: [],
    });
  for (const [key, value] of Object.entries(entries)) {
    const sep = key.lastIndexOf(PLAN_DAY_SEP);
    if (sep > 0) {
      const jour = Number(key.slice(sep + 1));
      if (Number.isFinite(jour)) ensure(key.slice(0, sep)).completedJours.push(jour);
      continue;
    }
    const info = objectOf(value);
    const plan = ensure(key);
    plan.startedAt = str(info.startedAt) ?? plan.startedAt;
    if (typeof info.lastJour === "number") plan.lastJour = info.lastJour;
  }
  for (const plan of Object.values(store)) {
    plan.completedJours = [...new Set(plan.completedJours)].sort((a, b) => a - b);
  }
  return store;
}

export const SYNCED_STORES: readonly SyncedStore[] = [
  {
    id: "highlights",
    docPath: userHighlightsDoc,
    readEntries: () => exportVerseMarkEntries(),
    writeEntries: (entries) =>
      replaceVerseMarkEntries(entries as Record<string, VerseMarkEntry>),
    subscribe: subscribeVerseMarksRevision,
    clearLocal: clearVerseMarkStore,
    migrateLocal: {
      timeOf: (_key, value) => str((value as VerseMarkEntry).markedAt),
      removed: readLegacyVerseMarkRemovals,
      done: dropLegacyVerseMarkRemovals,
    },
    /* Antigo: { store: { "JHN.3": { "16": cor } }, touched, removed }. */
    legacyRemote: (data) => {
      const touched = objectOf(data.touched) as Record<string, string>;
      const entries: Entries = {};
      for (const [chapter, verses] of Object.entries(objectOf(data.store))) {
        for (const [verse, color] of Object.entries(objectOf(verses))) {
          if (typeof color !== "string") continue;
          const key = `${chapter}:${verse}`;
          entries[key] = { color, markedAt: touched[key] || "" };
        }
      }
      return {
        entries,
        meta: metaFromTimes(
          entries,
          (key) => touched[key],
          objectOf(data.removed) as Record<string, string>,
        ),
      };
    },
  },
  noteStore({
    id: "notes",
    docPath: userNotesDoc,
    read: exportDayNoteStore,
    replace: replaceDayNoteStore as (store: DayNoteStore) => void,
    subscribe: subscribeDayNotes,
    clearLocal: clearDayNoteStore,
  }),
  noteStore({
    id: "verseNotes",
    docPath: userVerseNotesDoc,
    read: exportVerseNoteStore,
    replace: replaceVerseNoteStore as (store: VerseNoteStore) => void,
    subscribe: subscribeVerseNotes,
    clearLocal: clearVerseNoteStore,
  }),
  {
    id: "planProgress",
    docPath: userPlanProgressDoc,
    readEntries: () => planProgressToEntries(exportPlanProgressStore()),
    writeEntries: (entries) =>
      replacePlanProgressStore(planProgressFromEntries(entries)),
    subscribe: subscribePlanProgress,
    clearLocal: clearPlanProgressStore,
    legacyRemote: (data) => {
      const entries = planProgressToEntries(
        objectOf(data.store) as PlanProgressStore,
      );
      const at = str(data.updatedAt);
      return { entries, meta: metaFromTimes(entries, () => at) };
    },
  },
  {
    id: "activity",
    docPath: userActivityDoc,
    readEntries: () => {
      const entries: Entries = {};
      for (const event of exportActivityStore().events) entries[event.id] = event;
      return entries;
    },
    writeEntries: (entries) =>
      replaceActivityStore({ events: Object.values(entries) as ActivityEvent[] }),
    subscribe: subscribeActivity,
    clearLocal: clearActivityStore,
    migrateLocal: {
      timeOf: (_key, value) => str((value as ActivityEvent).at),
    },
    legacyRemote: (data) => {
      const entries: Entries = {};
      const events = objectOf(data.store).events;
      if (Array.isArray(events)) {
        for (const event of events as ActivityEvent[]) {
          if (event && typeof event.id === "string") entries[event.id] = event;
        }
      }
      return {
        entries,
        meta: metaFromTimes(entries, (_key, value) =>
          str((value as ActivityEvent).at),
        ),
      };
    },
  },
];

export function syncedStoreById(id: SyncedStoreId): SyncedStore | undefined {
  return SYNCED_STORES.find((store) => store.id === id);
}

export function isSyncedStoreId(value: unknown): value is SyncedStoreId {
  return SYNCED_STORES.some((store) => store.id === value);
}
