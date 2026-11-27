/**
 * Sync das atividades do utilizador entre dispositivos → users/{uid}/…
 * Nunca textos bíblicos. Os stores vivem em `SYNCED_STORES`; a fusão é a de
 * `syncEntries` (por entrada, última alteração ganha, remoções incluídas).
 *
 * Documento (schema 2): `{ schema, entries, meta, updatedAt }`, substituído
 * por inteiro em cada envio. Documentos do formato antigo (`{ store, … }`)
 * são lidos, fundidos e reescritos no formato novo.
 *
 * Garantias contra perda de dados:
 * - cada mudança local é datada (meta persistente) e marcada como pendente;
 * - push com debounce curto + flush ao esconder/fechar a página;
 * - no arranque: pull → fusão → reenvio do pendente;
 * - logout envia o pendente antes de limpar o aparelho.
 */

import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  onSnapshotsInSync,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureFirebase, getFirebaseDb } from "../../../lib/firebase";
import {
  persistLocalString,
  removePersistedString,
} from "../../../services/storage/StorageAdapter";
import {
  clearAllPendingStores,
  clearPendingStores,
  hasPendingStores,
  listPendingStores,
  markStorePending,
  migrateLegacyOutbox,
} from "./pendingSync";
import {
  cleanValue,
  mergeEntries,
  metaFromTimes,
  pruneTombstones,
  recordLocalChanges,
  wins,
  type Entries,
  type MetaMap,
} from "./syncEntries";
import { clearAllStoreMeta, readStoreMeta, writeStoreMeta } from "./syncMeta";
import {
  SYNCED_STORES,
  syncedStoreById,
  type SyncedStore,
  type SyncedStoreId,
} from "./syncedStores";

/**
 * - `idle`: sem sessão
 * - `pending`: há atividades por enviar (a enviar ou à espera)
 * - `synced`: tudo confirmado pelo servidor
 * - `offline`: guardado no aparelho; envia quando a rede voltar
 */
export type SyncStatus = "idle" | "synced" | "pending" | "offline";

export type SyncInfo = {
  status: SyncStatus;
  /** ISO da última sincronização completa confirmada (ou null). */
  lastSyncedAt: string | null;
};

const DOC_SCHEMA = 2;
const SYNC_STATUS_EVENT = "biblos-user-sync-status";
const LAST_SYNCED_KEY = "biblos.userSync.lastSyncedAt";

/** Debounce do push após um gesto (marca, nota, progresso…). */
const SYNC_PUSH_DEBOUNCE_MS = 1200;

/** Logout: espera no máximo isto pelo envio antes de limpar o aparelho. */
const SIGN_OUT_FLUSH_TIMEOUT_MS = 4000;

let currentUid: string | null = null;
let currentDb: Firestore | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubs: Unsubscribe[] = [];
let localUnsubs: Array<() => void> = [];
let syncStatus: SyncStatus = "idle";
let applyingRemote = false;

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function getLastSyncedAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNCED_KEY);
  } catch {
    return null;
  }
}

function emitSyncInfo() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SyncInfo>(SYNC_STATUS_EVENT, { detail: getSyncInfo() }),
  );
}

function setSyncStatus(next: SyncStatus) {
  if (syncStatus === next) return;
  syncStatus = next;
  emitSyncInfo();
}

/** Estado após push / snapshot: pendente local tem prioridade. */
function settleSyncStatus() {
  if (!currentUid) return setSyncStatus("idle");
  if (!isOnline()) return setSyncStatus("offline");
  if (hasPendingStores()) return setSyncStatus("pending");
  persistLocalString(LAST_SYNCED_KEY, nowIso());
  if (syncStatus === "synced") emitSyncInfo();
  else setSyncStatus("synced");
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function getSyncInfo(): SyncInfo {
  return { status: syncStatus, lastSyncedAt: getLastSyncedAt() };
}

export function subscribeSyncInfo(onChange: (info: SyncInfo) => void): () => void {
  const handler = () => onChange(getSyncInfo());
  window.addEventListener(SYNC_STATUS_EVENT, handler);
  handler();
  return () => window.removeEventListener(SYNC_STATUS_EVENT, handler);
}

function pathDoc(db: Firestore, path: string) {
  const [col, uid, sub, id] = path.split("/");
  return doc(db, col!, uid!, sub!, id!);
}

/* ---------------------------------------------------------------- local */

type LocalState = { entries: Entries; meta: MetaMap; changed: boolean };

/**
 * Estado local + meta atualizada com as mudanças desde a última leitura.
 * Na 1.ª execução de um store migra datas/remoções do formato antigo.
 */
function readLocalState(store: SyncedStore): LocalState {
  const entries = store.readEntries();
  const saved = readStoreMeta(store.id);
  const now = nowIso();
  if (saved === null) {
    const migrate = store.migrateLocal;
    const base = metaFromTimes({}, () => undefined, migrate?.removed?.() ?? {});
    const { meta } = recordLocalChanges(
      entries,
      base,
      now,
      migrate?.timeOf ?? (() => undefined),
    );
    writeStoreMeta(store.id, meta);
    migrate?.done?.();
    return { entries, meta, changed: Object.keys(meta).length > 0 };
  }
  const { meta, changed } = recordLocalChanges(entries, saved, now);
  if (changed) writeStoreMeta(store.id, meta);
  return { entries, meta, changed };
}

/* --------------------------------------------------------------- remote */

type RemoteState = { entries: Entries; meta: MetaMap; outdated: boolean };

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Documento → entradas + meta (funde a parte antiga, se existir). */
function readRemoteState(
  store: SyncedStore,
  data: Record<string, unknown> | undefined,
): RemoteState {
  if (!data) return { entries: {}, meta: {}, outdated: false };
  const current = data.schema === DOC_SCHEMA;
  const entries: Entries = current ? { ...objectOf(data.entries) } : {};
  const meta: MetaMap = current ? { ...(objectOf(data.meta) as MetaMap) } : {};
  /* `store` = formato antigo (ou escrito por uma versão antiga da app). */
  const hasLegacy = data.store !== undefined;
  if (hasLegacy) {
    const legacy = store.legacyRemote(data);
    for (const [key, m] of Object.entries(legacy.meta)) {
      if (meta[key] && !wins(m, meta[key]!)) continue;
      meta[key] = m;
      if (m.d) delete entries[key];
      else entries[key] = legacy.entries[key];
    }
  }
  return { entries, meta, outdated: !current || hasLegacy };
}

/** Funde o documento remoto no local; marca pendente se o remoto ficou atrás. */
function applyRemote(
  store: SyncedStore,
  data: Record<string, unknown> | undefined,
): void {
  const local = readLocalState(store);
  const remote = readRemoteState(store, data);
  const merged = mergeEntries(local.entries, local.meta, remote.entries, remote.meta);
  let behind = merged.remoteBehind || remote.outdated || local.changed;

  if (merged.localChanged) {
    applyingRemote = true;
    try {
      store.writeEntries(merged.entries);
    } finally {
      applyingRemote = false;
    }
  }
  writeStoreMeta(store.id, merged.meta);
  /* O store pode normalizar o que recebeu (ex. limite do histórico). */
  if (merged.localChanged && readLocalState(store).changed) behind = true;

  if (behind) {
    markStorePending(store.id);
    queueUserDataPush(currentUid);
  }
}

/* ----------------------------------------------------------------- push */

/**
 * Envia os stores indicados (documento inteiro, formato novo). Marcas
 * pendentes só são limpas após confirmação do servidor; offline, a promessa
 * espera (o SDK guarda a escrita em IndexedDB e envia depois).
 */
async function pushStores(
  uid: string,
  ids: readonly SyncedStoreId[],
): Promise<void> {
  if (!ids.length) {
    settleSyncStatus();
    return;
  }
  const ready = await ensureFirebase();
  if (!ready) return;
  const { db } = ready;
  const sentAt = nowIso();
  setSyncStatus(isOnline() ? "pending" : "offline");

  const writes = ids.flatMap((id) => {
    const store = syncedStoreById(id);
    if (!store) return [];
    const { entries } = readLocalState(store);
    const meta = pruneTombstones(readStoreMeta(id) ?? {}, Date.now());
    writeStoreMeta(id, meta);
    return [
      setDoc(pathDoc(db, store.docPath(uid)), {
        schema: DOC_SCHEMA,
        entries: cleanValue(entries),
        meta,
        updatedAt: sentAt,
      }),
    ];
  });

  try {
    await Promise.all(writes);
    clearPendingStores([...ids], sentAt);
  } catch (err) {
    console.warn("[user-sync] push", err);
    throw err;
  } finally {
    if (currentUid === uid) settleSyncStatus();
  }
}

/** Push com debounce de tudo o que está pendente. */
export function queueUserDataPush(uid?: string | null): void {
  const target = uid ?? currentUid;
  if (!target) return;
  if (pushTimer) clearTimeout(pushTimer);
  setSyncStatus(isOnline() ? "pending" : "offline");
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushStores(target, listPendingStores()).catch(() => undefined);
  }, SYNC_PUSH_DEBOUNCE_MS);
}

/** Push imediato do pendente. */
export async function flushUserDataPush(uid?: string | null): Promise<void> {
  const target = uid ?? currentUid;
  if (!target) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await pushStores(target, listPendingStores());
}

/**
 * Antes do logout: envia o pendente (até um limite de tempo). Mesmo que o
 * tempo esgote, as escritas já ficaram na fila persistente do Firestore.
 */
export async function flushUserDataBeforeSignOut(): Promise<void> {
  if (!currentUid) return;
  for (const store of SYNCED_STORES) {
    if (readLocalState(store).changed) markStorePending(store.id);
  }
  if (!hasPendingStores()) return;
  await Promise.race([
    flushUserDataPush(currentUid).catch(() => undefined),
    new Promise<void>((resolve) =>
      setTimeout(resolve, SIGN_OUT_FLUSH_TIMEOUT_MS),
    ),
  ]);
}

/* ------------------------------------------------------------ lifecycle */

function onLocalChange(store: SyncedStore) {
  if (applyingRemote) return;
  /* Eventos `storage` de outras abas sem mudança real não geram push. */
  if (!readLocalState(store).changed) return;
  markStorePending(store.id);
  queueUserDataPush(currentUid);
}

function onWindowOnline() {
  if (!currentUid) return;
  void flushUserDataPush(currentUid).catch(() => undefined);
}

function onWindowOffline() {
  if (currentUid) setSyncStatus("offline");
}

/** Página a esconder/fechar: não esperar pelo debounce. */
function onPageHide() {
  if (!currentUid) return;
  if (!pushTimer && !hasPendingStores()) return;
  void flushUserDataPush(currentUid).catch(() => undefined);
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") onPageHide();
}

function stopListeners() {
  for (const stop of unsubs) stop();
  unsubs = [];
  for (const stop of localUnsubs) stop();
  localUnsubs = [];
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("online", onWindowOnline);
    window.removeEventListener("offline", onWindowOffline);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }
}

/** Pull de todos os documentos → fusão → envio do que ficou pendente. */
async function reconcile(db: Firestore, uid: string): Promise<void> {
  const snaps = await Promise.all(
    SYNCED_STORES.map((store) => getDoc(pathDoc(db, store.docPath(uid)))),
  );
  if (currentUid !== uid) return;
  SYNCED_STORES.forEach((store, i) => {
    const snap = snaps[i]!;
    applyRemote(
      store,
      snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
    );
  });
  await flushUserDataPush(uid);
}

/**
 * Sincronizar agora (gesto do utilizador): pull completo + envio.
 * Offline, devolve logo (o envio segue quando a rede voltar).
 */
export async function syncUserDataNow(): Promise<void> {
  const uid = currentUid;
  const db = currentDb;
  if (!uid || !db) return;
  if (!isOnline()) {
    setSyncStatus("offline");
    return;
  }
  setSyncStatus("pending");
  try {
    await reconcile(db, uid);
  } catch (err) {
    console.warn("[user-sync] sync now", err);
    settleSyncStatus();
  }
}

/**
 * Inicia a sync para um uid Firebase (anónimo ou autenticado):
 * onSnapshot (tempo real) + push com debounce nas mudanças locais.
 * Resolve depois da 1.ª reconciliação.
 */
export async function startUserDataSync(uid: string): Promise<void> {
  if (currentUid === uid && unsubs.length) return;
  stopListeners();
  currentUid = uid;
  migrateLegacyOutbox();
  setSyncStatus(
    !isOnline() ? "offline" : hasPendingStores() ? "pending" : "synced",
  );

  const ready = await ensureFirebase();
  if (!ready) {
    setSyncStatus("offline");
    return;
  }
  if (currentUid !== uid) return;
  const { db } = ready;
  currentDb = db;

  for (const store of SYNCED_STORES) {
    unsubs.push(
      onSnapshot(
        pathDoc(db, store.docPath(uid)),
        (snap) =>
          applyRemote(store, snap.data() as Record<string, unknown> | undefined),
        (err) => console.warn(`[user-sync] ${store.id}`, err),
      ),
    );
    localUnsubs.push(store.subscribe(() => onLocalChange(store)));
  }

  unsubs.push(onSnapshotsInSync(db, settleSyncStatus));

  if (typeof window !== "undefined") {
    window.addEventListener("online", onWindowOnline);
    window.addEventListener("offline", onWindowOffline);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  try {
    await reconcile(db, uid);
  } catch (err) {
    console.warn("[user-sync] reconcile", err);
    settleSyncStatus();
  }
}

export function stopUserDataSync(): void {
  stopListeners();
  currentUid = null;
  currentDb = null;
  setSyncStatus("idle");
}

/** Apaga dados pessoais locais (com a sync parada) — mantém Bíblias offline. */
export function clearPersonalLocalData(): void {
  for (const store of SYNCED_STORES) store.clearLocal();
  clearAllStoreMeta();
  clearAllPendingStores();
  removePersistedString(LAST_SYNCED_KEY);
}

export async function deleteUserCloudData(uid: string): Promise<void> {
  const db = getFirebaseDb() ?? (await ensureFirebase())?.db;
  if (!db) return;
  await Promise.all(
    SYNCED_STORES.map((store) =>
      deleteDoc(pathDoc(db, store.docPath(uid))).catch(() => undefined),
    ),
  );
}

export function exportUserBackupJson(meta?: {
  uid?: string | null;
  email?: string | null;
}): string {
  const stores: Partial<Record<SyncedStoreId, Entries>> = {};
  for (const store of SYNCED_STORES) stores[store.id] = store.readEntries();
  return JSON.stringify(
    { exportedAt: nowIso(), app: "biblos", meta: meta ?? {}, stores },
    null,
    2,
  );
}

export function downloadUserBackupJson(filename = "biblos-backup.json"): void {
  const json = exportUserBackupJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
