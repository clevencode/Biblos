/** window / localStorage / document mínimos para correr o user-sync em Node. */
const store = new Map<string, string>();
const target = new EventTarget();
(globalThis as any).window = globalThis;
(globalThis as any).addEventListener = target.addEventListener.bind(target);
(globalThis as any).removeEventListener = target.removeEventListener.bind(target);
(globalThis as any).dispatchEvent = target.dispatchEvent.bind(target);
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
};
const docTarget = new EventTarget();
(globalThis as any).document = { visibilityState: 'visible', addEventListener: docTarget.addEventListener.bind(docTarget), removeEventListener: docTarget.removeEventListener.bind(docTarget), dispatchEvent: docTarget.dispatchEvent.bind(docTarget) };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, userAgent: 'node' }, configurable: true });
export const storage = store;
