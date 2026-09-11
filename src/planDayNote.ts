/** Notes quotidiennes du plan de lecture (local + Notion). */

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

export async function pullDayNote(
  planId: string,
  planUrl: string | null | undefined,
  jour: number,
): Promise<{ text: string; notionUrl: string | null; ok: boolean; error?: string }> {
  const local = loadDayNote(planId, jour);
  if (!planUrl) {
    return { text: local?.text ?? "", notionUrl: local?.notionUrl ?? null, ok: true };
  }
  try {
    const params = new URLSearchParams({
      planUrl,
      jour: String(jour),
    });
    if (local?.notionUrl) params.set("noteUrl", local.notionUrl);
    const response = await fetch(`/api/plan-day-note?${params}`);
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      body?: string;
      url?: string | null;
      error?: string;
      hasToken?: boolean;
    };
    if (!payload.ok) {
      return {
        text: local?.text ?? "",
        notionUrl: local?.notionUrl ?? null,
        ok: false,
        error: payload.error || "échec lecture Notion",
      };
    }
    const remoteText = typeof payload.body === "string" ? payload.body : "";
    const notionUrl = payload.url ?? local?.notionUrl ?? null;
    // Prefer remote if present; keep local draft if remote empty and local has text.
    const text = remoteText.trim() ? remoteText : (local?.text ?? "");
    saveDayNoteLocal(planId, jour, { text, notionUrl });
    return { text, notionUrl, ok: true };
  } catch {
    return {
      text: local?.text ?? "",
      notionUrl: local?.notionUrl ?? null,
      ok: false,
      error: "API note quotidienne indisponible",
    };
  }
}

export async function pushDayNote(
  planId: string,
  planUrl: string | null | undefined,
  jour: number,
  text: string,
): Promise<{ ok: boolean; notionUrl: string | null; error?: string }> {
  const trimmed = String(text ?? "");
  const local = saveDayNoteLocal(planId, jour, { text: trimmed });
  if (!planUrl) {
    return { ok: false, notionUrl: local.notionUrl ?? null, error: "Plan sans URL Notion" };
  }
  try {
    const response = await fetch("/api/plan-day-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planUrl,
        jour,
        body: trimmed,
        noteUrl: local.notionUrl || undefined,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      url?: string | null;
      error?: string;
    };
    if (!payload.ok) {
      return {
        ok: false,
        notionUrl: local.notionUrl ?? null,
        error: payload.error || "échec enregistrement Notion",
      };
    }
    const notionUrl = payload.url ?? local.notionUrl ?? null;
    saveDayNoteLocal(planId, jour, { text: trimmed, notionUrl });
    return { ok: true, notionUrl };
  } catch {
    return {
      ok: false,
      notionUrl: local.notionUrl ?? null,
      error: "API note quotidienne indisponible",
    };
  }
}
