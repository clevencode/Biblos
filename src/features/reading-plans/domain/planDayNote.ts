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
  notifyDayNotesChanged();
  return record;
}

export type DayNoteStore = Store;

export function exportDayNoteStore(): DayNoteStore {
  return readStore();
}

export function importDayNoteStore(
  incoming: DayNoteStore,
  merge = true,
): boolean {
  if (!incoming || typeof incoming !== "object") return false;
  const store = merge ? { ...readStore() } : {};
  let changed = false;
  for (const [key, remote] of Object.entries(incoming)) {
    if (!remote || typeof remote !== "object") continue;
    const local = store[key];
    if (
      merge &&
      local?.updatedAt &&
      remote.updatedAt &&
      local.updatedAt >= remote.updatedAt
    ) {
      continue;
    }
    store[key] = {
      text: String(remote.text ?? ""),
      updatedAt:
        typeof remote.updatedAt === "string" && remote.updatedAt
          ? remote.updatedAt
          : new Date().toISOString(),
    };
    changed = true;
  }
  if (changed) {
    writeStore(store);
    notifyDayNotesChanged();
  }
  return changed;
}

const DAY_NOTES_EVENT = "biblos-day-notes";

function notifyDayNotesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DAY_NOTES_EVENT));
  }
}

export function subscribeDayNotes(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(DAY_NOTES_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DAY_NOTES_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Efface notes locales (logout / delete account) — pas les Bibles. */
export function clearDayNoteStore(): void {
  try {
    localStorage.removeItem(STORE_KEY);
    notifyDayNotesChanged();
  } catch {
    /* ignore */
  }
}
