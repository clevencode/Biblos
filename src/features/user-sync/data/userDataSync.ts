/**
 * Sync offline-first das atividades do utilizador → users/{uid}/… (Firestore).
 * Nunca textos bíblicos. Os stores sincronizados vivem em `SYNCED_STORES`.
 *
 * Garantias contra perda de dados:
 * - cada mudança local marca o store como pendente (persistente) antes do push;
 * - push com debounce curto + flush imediato ao esconder/fechar a página;
 * - no arranque (ou após reiniciar o navegador): pull → merge → reenvio do que
 *   ficou pendente e seed do que só existe localmente;
 * - logout envia o pendente antes de limpar o aparelho.
 *
 * O Firestore usa cache persistente (IndexedDB): um `setDoc` feito offline fica
 * na fila do SDK e é enviado quando a rede volta, mesmo após reiniciar.
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
  clearAllPendingStores,
  clearPendingStores,
  hasPendingStores,
  listPendingStores,
  markStorePending,
  migrateLegacyOutbox,
} from "./pendingSync";
import {
  SYNCED_STORES,
  syncedStoreById,
  type SyncedPayload,
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

const SYNC_STATUS_EVENT = "biblos-user-sync-status";

/** Debounce do push após um gesto (marca, nota, progresso…). */
const SYNC_PUSH_DEBOUNCE_MS = 1200;

/** Logout: espera no máximo isto pelo envio antes de limpar o aparelho. */
const SIGN_OUT_FLUSH_TIMEOUT_MS = 4000;

let currentUid: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubs: Unsubscribe[] = [];
let localUnsubs: Array<() => void> = [];
let syncStatus: SyncStatus = "idle";
let applyingRemote = false;
/**
 * Último conteúdo conhecido por store. Os stores também emitem em eventos
 * `storage` de outras abas (qualquer chave); só uma mudança real de conteúdo
 * marca pendente — evita ciclos entre abas.
 */
const lastSeen = new Map<SyncedStoreId, string>();

function fingerprint(store: SyncedStore): string {
  try {
    return JSON.stringify(store.exportLocal());
  } catch {
    return "";
  }
}

/** `true` se o conteúdo mudou desde a última leitura. */
function refreshSeen(store: SyncedStore): boolean {
  const next = fingerprint(store);
  if (lastSeen.get(store.id) === next) return false;
  lastSeen.set(store.id, next);
  return true;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

function setSyncStatus(next: SyncStatus) {
  if (syncStatus === next) return;
  syncStatus = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: next }));
  }
}

/** Estado após um push / snapshot: pendente local tem prioridade. */
function settleSyncStatus() {
  if (!currentUid) {
    setSyncStatus("idle");
    return;
  }
  if (!isOnline()) {
    setSyncStatus("offline");
    return;
  }
  setSyncStatus(hasPendingStores() ? "pending" : "synced");
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function subscribeSyncStatus(
  onChange: (status: SyncStatus) => void,
): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<SyncStatus>).detail;
    onChange(detail ?? getSyncStatus());
  };
  window.addEventListener(SYNC_STATUS_EVENT, handler);
  onChange(syncStatus);
  return () => window.removeEventListener(SYNC_STATUS_EVENT, handler);
}

function pathDoc(db: Firestore, path: string) {
  const [col, uid, sub, id] = path.split("/");
  return doc(db, col!, uid!, sub!, id!);
}

/**
 * Envia os stores indicados. Marcas pendentes só são limpas após confirmação
 * do servidor; offline, a promessa espera (o SDK guarda a escrita em IndexedDB).
 */
async function pushStores(
  uid: string,
  ids: readonly SyncedStoreId[],
  opts?: { skipEmpty?: boolean },
): Promise<void> {
  if (!ids.length) {
    settleSyncStatus();
    return;
  }
  const ready = await ensureFirebase();
  if (!ready) return;
  const { db } = ready;
  const sentAt = new Date().toISOString();
  setSyncStatus(isOnline() ? "pending" : "offline");

  const sent: SyncedStoreId[] = [];
  const writes: Array<Promise<unknown>> = [];
  for (const id of ids) {
    const store = syncedStoreById(id);
    if (!store) continue;
    const payload = store.exportLocal();
    sent.push(id);
    if (opts?.skipEmpty && store.isEmpty(payload)) continue;
    writes.push(
      setDoc(
        pathDoc(db, store.docPath(uid)),
        { ...payload, updatedAt: sentAt },
        { merge: true },
      ),
    );
  }

  try {
    await Promise.all(writes);
    clearPendingStores(sent, sentAt);
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

/**
 * Push imediato. Por omissão envia só o pendente; `all` envia todos os stores
 * (ex. após login, para fundir o anónimo na conta), saltando os vazios.
 */
export async function flushUserDataPush(
  uid?: string | null,
  opts?: { all?: boolean },
): Promise<void> {
  const target = uid ?? currentUid;
  if (!target) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (opts?.all) {
    await pushStores(
      target,
      SYNCED_STORES.map((store) => store.id),
      { skipEmpty: true },
    );
    return;
  }
  await pushStores(target, listPendingStores());
}

/**
 * Antes do logout: envia o pendente (até um limite de tempo). Mesmo que o
 * tempo esgote, as escritas já ficaram na fila persistente do Firestore.
 */
export async function flushUserDataBeforeSignOut(): Promise<void> {
  if (!currentUid) return;
  if (!pushTimer && !hasPendingStores()) return;
  await Promise.race([
    flushUserDataPush(currentUid).catch(() => undefined),
    new Promise<void>((resolve) =>
      setTimeout(resolve, SIGN_OUT_FLUSH_TIMEOUT_MS),
    ),
  ]);
}

function applyRemote(store: SyncedStore, data: SyncedPayload | undefined) {
  if (!data) return;
  applyingRemote = true;
  let changed = false;
  try {
    changed = store.mergeRemote(data);
  } finally {
    applyingRemote = false;
  }
  refreshSeen(store);
  /* O merge pode juntar dados locais que o remoto ainda não tem → reenvia. */
  if (changed) {
    markStorePending(store.id);
    queueUserDataPush(currentUid);
  }
}

function onLocalChange(store: SyncedStore) {
  if (applyingRemote) return;
  if (!refreshSeen(store)) return;
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

/**
 * Arranque / reinício: funde o remoto, depois envia o que ficou pendente
 * e semeia stores que só existem no aparelho. Nunca envia stores vazios
 * por seed (evita apagar dados de outro aparelho).
 */
async function reconcile(db: Firestore, uid: string): Promise<void> {
  const snaps = await Promise.all(
    SYNCED_STORES.map((store) => getDoc(pathDoc(db, store.docPath(uid)))),
  );
  if (currentUid !== uid) return;

  const pending = new Set(listPendingStores());
  const toPush: SyncedStoreId[] = [];
  SYNCED_STORES.forEach((store, i) => {
    const snap = snaps[i]!;
    const remote = snap.exists()
      ? (snap.data() as SyncedPayload)
      : undefined;
    applyRemote(store, remote);
    const local = store.exportLocal();
    const seed = store.isEmpty(remote) && !store.isEmpty(local);
    if (seed || pending.has(store.id)) toPush.push(store.id);
  });

  for (const id of toPush) markStorePending(id);
  await flushUserDataPush(uid);
}

/**
 * Inicia a sync para um uid Firebase (anónimo ou autenticado).
 * Pull via onSnapshot + push com debounce nas mudanças locais.
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

  for (const store of SYNCED_STORES) {
    unsubs.push(
      onSnapshot(
        pathDoc(db, store.docPath(uid)),
        (snap) => applyRemote(store, snap.data() as SyncedPayload | undefined),
        (err) => console.warn(`[user-sync] ${store.id}`, err),
      ),
    );
    refreshSeen(store);
    localUnsubs.push(store.subscribe(() => onLocalChange(store)));
  }

  unsubs.push(onSnapshotsInSync(db, settleSyncStatus));

  if (typeof window !== "undefined") {
    window.addEventListener("online", onWindowOnline);
    window.addEventListener("offline", onWindowOffline);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  void reconcile(db, uid).catch((err) => {
    console.warn("[user-sync] reconcile", err);
    settleSyncStatus();
  });
}

export function stopUserDataSync(): void {
  stopListeners();
  lastSeen.clear();
  currentUid = null;
  setSyncStatus("idle");
}

export type LocalUserDataSnapshot = Partial<Record<SyncedStoreId, SyncedPayload>>;

/** Snapshot local antes de entrar numa conta existente (para fundir depois). */
export function snapshotLocalUserData(): LocalUserDataSnapshot {
  const out: LocalUserDataSnapshot = {};
  for (const store of SYNCED_STORES) out[store.id] = store.exportLocal();
  return out;
}

export function mergeLocalSnapshotIntoStores(
  snapshot: LocalUserDataSnapshot,
): void {
  for (const store of SYNCED_STORES) {
    const payload = snapshot[store.id];
    if (payload) store.mergeRemote(payload);
  }
}

/** Apaga dados pessoais locais — mantém Bíblias offline. */
export function clearPersonalLocalData(): void {
  for (const store of SYNCED_STORES) store.clearLocal();
  clearAllPendingStores();
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
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "biblos",
      meta: meta ?? {},
      stores: snapshotLocalUserData(),
    },
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
