/**
 * Fila persistente de atividades por enviar ao Firestore.
 *
 * Cada mudança local marca o store como pendente *antes* do push (debounce).
 * Se o navegador fechar/reiniciar antes do envio, o arranque seguinte vê a
 * marca e reenvia — a atividade nunca fica só no aparelho.
 */

import {
  persistLocalString,
  removePersistedString,
} from "../../../services/storage/StorageAdapter";
import { isSyncedStoreId, type SyncedStoreId } from "./syncedStores";

const STORAGE_KEY = "biblos.userSync.pending.v1";
/** Fila anterior (só marcas) — migrada uma vez para este formato. */
const LEGACY_OUTBOX_KEY = "biblos.syncOutbox.v1";

/** id do store → ISO da última mudança ainda não confirmada. */
type PendingMap = Partial<Record<SyncedStoreId, string>>;

function readPending(): PendingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: PendingMap = {};
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (isSyncedStoreId(id) && typeof at === "string") out[id] = at;
    }
    return out;
  } catch {
    return {};
  }
}

function writePending(map: PendingMap): void {
  if (Object.keys(map).length === 0) {
    removePersistedString(STORAGE_KEY);
    return;
  }
  persistLocalString(STORAGE_KEY, JSON.stringify(map));
}

export function markStorePending(id: SyncedStoreId): void {
  const map = readPending();
  map[id] = new Date().toISOString();
  writePending(map);
}

export function listPendingStores(): SyncedStoreId[] {
  return Object.keys(readPending()) as SyncedStoreId[];
}

export function hasPendingStores(): boolean {
  return listPendingStores().length > 0;
}

/**
 * Confirma o envio. Só limpa marcas com última mudança até ao início do push —
 * uma mudança feita durante o envio continua pendente.
 */
export function clearPendingStores(ids: SyncedStoreId[], sentAt: string): void {
  const map = readPending();
  let changed = false;
  for (const id of ids) {
    const at = map[id];
    if (at && at <= sentAt) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) writePending(map);
}

/** Marcas que estavam na fila antiga ficam pendentes no formato novo. */
export function migrateLegacyOutbox(): void {
  try {
    const raw = localStorage.getItem(LEGACY_OUTBOX_KEY);
    if (raw == null) return;
    const items = JSON.parse(raw) as unknown;
    if (Array.isArray(items) && items.length > 0) {
      markStorePending("highlights");
    }
  } catch {
    /* fila corrompida: nada a migrar */
  }
  removePersistedString(LEGACY_OUTBOX_KEY);
}

export function clearAllPendingStores(): void {
  removePersistedString(STORAGE_KEY);
}
