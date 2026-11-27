/**
 * Meta de sincronização por store (datas / hashes / remoções por chave),
 * persistida no aparelho para que edições e remoções feitas offline ou
 * antes de reiniciar sejam datadas corretamente.
 */

import {
  persistLocalString,
  removePersistedString,
  STORAGE_PREF_KEYS,
} from "../../../services/storage/StorageAdapter";
import type { MetaMap } from "./syncEntries";
import type { SyncedStoreId } from "./syncedStores";

const STORAGE_KEY = STORAGE_PREF_KEYS.userSyncMeta;

type MetaFile = Partial<Record<SyncedStoreId, MetaMap>>;

function readFile(): MetaFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as MetaFile) : {};
  } catch {
    return {};
  }
}

/** `null` = store ainda sem registo (1.ª execução → migração). */
export function readStoreMeta(id: SyncedStoreId): MetaMap | null {
  return readFile()[id] ?? null;
}

export function writeStoreMeta(id: SyncedStoreId, meta: MetaMap): void {
  const file = readFile();
  file[id] = meta;
  persistLocalString(STORAGE_KEY, JSON.stringify(file));
}

export function clearAllStoreMeta(): void {
  removePersistedString(STORAGE_KEY);
}
