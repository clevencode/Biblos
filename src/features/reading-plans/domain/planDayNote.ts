/** Notes quotidiennes — stockage local uniquement. */

export type DayNoteRecord = {
  text: string;
  updatedAt: string;
};

const STORE_KEY = "biblos-day-notes-v1";

type Store = Record<string, DayNoteRecord>;

function noteKey(planId: string, jour: number): string {
  return `${planId}:${jour}`;
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function loadDayNote(planId: string, jour: number): DayNoteRecord | null {
  if (!planId || !jour) return null;
  return readStore()[noteKey(planId, jour)] ?? null;
}

export function saveDayNoteLocal(planId: string, jour: number, text: string): DayNoteRecord {
  const store = readStore();
  const record: DayNoteRecord = {
    text: text.trim(),
    updatedAt: new Date().toISOString(),
  };
  store[noteKey(planId, jour)] = record;
  writeStore(store);
  return record;
}
