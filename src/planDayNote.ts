/** Notes quotidiennes du plan — stockage local uniquement (jamais Notion). */

export type DayNoteRecord = {
  text: string;
  notionUrl?: string | null;
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
    /* private mode */
  }
}

export function loadDayNote(planId: string, jour: number): DayNoteRecord | null {
  if (!planId || !jour) return null;
  return readStore()[noteKey(planId, jour)] ?? null;
}

export function saveDayNoteLocal(
  planId: string,
  jour: number,
  patch: Partial<DayNoteRecord> & { text?: string },
): DayNoteRecord {
  const store = readStore();
  const key = noteKey(planId, jour);
  const prev = store[key];
  const next: DayNoteRecord = {
    text: typeof patch.text === "string" ? patch.text : (prev?.text ?? ""),
    notionUrl:
      patch.notionUrl !== undefined ? patch.notionUrl : (prev?.notionUrl ?? null),
    updatedAt: new Date().toISOString(),
  };
  store[key] = next;
  writeStore(store);
  return next;
}

export function clearDayNotesForPlan(planId: string): void {
  if (!planId) return;
  const store = readStore();
  const prefix = `${planId}:`;
  let changed = false;
  for (const key of Object.keys(store)) {
    if (!key.startsWith(prefix)) continue;
    delete store[key];
    changed = true;
  }
  if (changed) writeStore(store);
}

/** Lecture locale uniquement (pas de pull Notion). */
export async function pullDayNote(
  planId: string,
  _planUrl: string | null | undefined,
  jour: number,
): Promise<{ text: string; notionUrl: string | null; ok: boolean; error?: string }> {
  const local = loadDayNote(planId, jour);
  return { text: local?.text ?? "", notionUrl: local?.notionUrl ?? null, ok: true };
}

/** Enregistrement local uniquement (pas de push Notion). */
export async function pushDayNote(
  planId: string,
  _planUrl: string | null | undefined,
  jour: number,
  text: string,
  _meta?: {
    planName?: string;
    passage?: string;
    userId?: string;
    displayName?: string;
  },
): Promise<{ ok: boolean; notionUrl: string | null; error?: string; localOnly?: boolean }> {
  const trimmed = String(text ?? "");
  const local = saveDayNoteLocal(planId, jour, { text: trimmed });
  return {
    ok: true,
    notionUrl: local.notionUrl ?? null,
    localOnly: true,
    error: trimmed.trim() ? undefined : "Note vide",
  };
}
