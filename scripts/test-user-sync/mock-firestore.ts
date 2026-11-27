/** Firestore em memória para scripts/test-user-sync (só o que o user-sync usa). */
type Data = Record<string, unknown>;
export const remote = new Map<string, Data>();
export const writes: string[] = [];
const listeners = new Map<string, Set<(snap: unknown) => void>>();
export let online = true;
const pendingWrites: Array<() => void> = [];
export function setOnline(v: boolean) { online = v; if (v) { while (pendingWrites.length) pendingWrites.shift()!(); } }
function snap(path: string) { const d = remote.get(path); return { exists: () => d != null, data: () => (d ? structuredClone(d) : undefined) }; }
function emit(path: string) { for (const cb of listeners.get(path) ?? []) cb(snap(path)); }
function deepMerge(a: any, b: any): any {
  if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object' && !Array.isArray(a)) {
    const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = deepMerge(a[k], v); return out;
  }
  return structuredClone(b);
}
export const doc = (_db: unknown, ...parts: string[]) => parts.join('/');
export async function getDoc(path: string) { return snap(path); }
export function setDoc(path: string, data: Data, opts?: { merge?: boolean }) {
  writes.push(path.split('/')[2]!);
  const apply = () => { remote.set(path, opts?.merge ? deepMerge(remote.get(path) ?? {}, data) : structuredClone(data)); emit(path); };
  return new Promise<void>((res) => { const go = () => { apply(); res(); }; if (online) queueMicrotask(go); else pendingWrites.push(go); });
}
export async function deleteDoc(path: string) { remote.delete(path); emit(path); }
export function onSnapshot(path: string, cb: (s: unknown) => void) {
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path)!.add(cb); queueMicrotask(() => cb(snap(path)));
  return () => listeners.get(path)!.delete(cb);
}
export function onSnapshotsInSync() { return () => undefined; }
export type Firestore = unknown; export type Unsubscribe = () => void;
