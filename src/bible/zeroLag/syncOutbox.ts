/**
 * Outbox offline — mutações de utilizador entram na fila imediatamente (UI 0 ms).
 * Flush assíncrono via user-sync (Firestore) em background.
 */

import { persistLocalString } from "../../services/storage/StorageAdapter";

const STORAGE_KEY = "biblos.syncOutbox.v1";
const EVENT = "biblos-sync-outbox";
const MAX_ITEMS = 200;

export type OutboxKind =
  | "verse_mark"
  | "verse_note"
  | "day_note"
  | "plan_progress";

export type OutboxItem = {
  id: string;
  kind: OutboxKind;
  createdAt: string;
  status: "pending" | "syncing" | "done" | "error";
  /** Payload opaco — o flush usa o store canónico, não este corpo. */
  hint?: string;
  error?: string;
};

function readQueue(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OutboxItem =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as OutboxItem).id === "string",
    );
  } catch {
    return [];
  }
}

function writeQueue(items: OutboxItem[]): void {
  const trimmed = items.slice(-MAX_ITEMS);
  persistLocalString(STORAGE_KEY, JSON.stringify(trimmed));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: trimmed.length }));
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Enfileira mutação após escrita local optimistic. */
export function enqueueOutbox(
  kind: OutboxKind,
  hint?: string,
): OutboxItem {
  const items = readQueue().filter((item) => item.status !== "done");
  const item: OutboxItem = {
    id: newId(),
    kind,
    createdAt: new Date().toISOString(),
    status: "pending",
    hint,
  };
  items.push(item);
  writeQueue(items);
  return item;
}

export function listOutboxPending(): OutboxItem[] {
  return readQueue().filter(
    (item) => item.status === "pending" || item.status === "error",
  );
}

export function markOutboxSyncing(ids: string[]): void {
  const set = new Set(ids);
  const items = readQueue().map((item) =>
    set.has(item.id) ? { ...item, status: "syncing" as const } : item,
  );
  writeQueue(items);
}

export function markOutboxDone(ids: string[]): void {
  const set = new Set(ids);
  const items = readQueue()
    .map((item) =>
      set.has(item.id) ? { ...item, status: "done" as const } : item,
    )
    .filter((item) => item.status !== "done");
  writeQueue(items);
}

export function markOutboxError(ids: string[], error: string): void {
  const set = new Set(ids);
  const items = readQueue().map((item) =>
    set.has(item.id)
      ? { ...item, status: "error" as const, error }
      : item,
  );
  writeQueue(items);
}

export function clearOutbox(): void {
  writeQueue([]);
}

export function subscribeOutbox(
  onChange: (pendingCount: number) => void,
): () => void {
  const handler = () => onChange(listOutboxPending().length);
  window.addEventListener(EVENT, handler);
  handler();
  return () => window.removeEventListener(EVENT, handler);
}

/**
 * Executa flush do host e marca a fila.
 * `flushFn` = push Firestore (já optimistic no localStorage).
 */
export async function drainOutbox(
  flushFn: () => Promise<void>,
): Promise<{ flushed: number; ok: boolean }> {
  const pending = listOutboxPending();
  if (pending.length === 0) {
    await flushFn();
    return { flushed: 0, ok: true };
  }
  const ids = pending.map((item) => item.id);
  markOutboxSyncing(ids);
  try {
    await flushFn();
    markOutboxDone(ids);
    return { flushed: ids.length, ok: true };
  } catch (err) {
    markOutboxError(
      ids,
      err instanceof Error ? err.message : String(err),
    );
    return { flushed: 0, ok: false };
  }
}
