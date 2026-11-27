/**
 * Modelo único de sincronização entre dispositivos (puro, sem I/O).
 *
 * Toda a atividade é um mapa `chave → valor`. Cada chave tem meta
 * `{ at, h, d? }`: data da última alteração, hash do valor e marca de remoção
 * (tombstone). A fusão é por chave: **a alteração mais recente ganha** —
 * incluindo remoções, que assim se propagam a todos os dispositivos.
 */

export type EntryMeta = {
  /** ISO da última alteração (ou remoção) desta chave. */
  at: string;
  /** Hash do valor ("" quando removida). */
  h: string;
  /** 1 = removida (tombstone). */
  d?: 1;
};

export type MetaMap = Record<string, EntryMeta>;
export type Entries = Record<string, unknown>;

/** Data para entradas sem histórico: perdem para qualquer alteração datada. */
export const EPOCH = "1970-01-01T00:00:00.000Z";

/** Remoções mais antigas que isto deixam de ser guardadas. */
export const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

/** JSON com chaves ordenadas — o mesmo valor dá sempre o mesmo texto. */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(",")}}`;
}

/** FNV-1a 32 bits do JSON estável (comparação barata de valores). */
export function hashValue(value: unknown): string {
  const text = stableJson(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Remove `undefined` (o Firestore rejeita-o) e copia o valor. */
export function cleanValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

/**
 * Regista na meta as mudanças locais (novas, editadas, removidas).
 * `initialAt` só na 1.ª execução de um store: data a atribuir às entradas
 * que já existiam antes do registo (por omissão `EPOCH`).
 */
export function recordLocalChanges(
  entries: Entries,
  meta: MetaMap,
  now: string,
  initialAt?: (key: string, value: unknown) => string | undefined,
): { meta: MetaMap; changed: boolean } {
  const next: MetaMap = { ...meta };
  let changed = false;
  for (const [key, value] of Object.entries(entries)) {
    const h = hashValue(value);
    const current = next[key];
    if (current && !current.d && current.h === h) continue;
    const at = initialAt ? initialAt(key, value) || EPOCH : now;
    next[key] = { at, h };
    changed = true;
  }
  for (const [key, current] of Object.entries(next)) {
    if (current.d || key in entries) continue;
    next[key] = { at: now, h: "", d: 1 };
    changed = true;
  }
  return { meta: next, changed };
}

export type MergeResult = {
  entries: Entries;
  meta: MetaMap;
  /** O local mudou (gravar no store). */
  localChanged: boolean;
  /** O remoto não tem tudo o que o local tem (enviar). */
  remoteBehind: boolean;
};

/** `true` se `a` deve ganhar a `b` (data maior; empate → hash maior). */
export function wins(a: EntryMeta, b: EntryMeta): boolean {
  if (a.at !== b.at) return a.at > b.at;
  return a.h > b.h;
}

function sameState(a: EntryMeta, b: EntryMeta): boolean {
  return a.h === b.h && Boolean(a.d) === Boolean(b.d);
}

/** Funde remoto no local, chave a chave (última alteração ganha). */
export function mergeEntries(
  local: Entries,
  localMeta: MetaMap,
  remote: Entries,
  remoteMeta: MetaMap,
): MergeResult {
  const entries: Entries = { ...local };
  const meta: MetaMap = { ...localMeta };
  let localChanged = false;
  let remoteBehind = false;

  const keys = new Set([...Object.keys(localMeta), ...Object.keys(remoteMeta)]);
  for (const key of keys) {
    const l = localMeta[key];
    const r = remoteMeta[key];
    if (!r) {
      remoteBehind = true;
      continue;
    }
    if (l && sameState(l, r)) {
      /* Mesmo conteúdo: alinha só a data, sem tocar no store. */
      if (r.at > l.at) meta[key] = r;
      else if (l.at > r.at) remoteBehind = true;
      continue;
    }
    if (l && !wins(r, l)) {
      remoteBehind = true;
      continue;
    }
    if (r.d) {
      if (key in entries) {
        delete entries[key];
        localChanged = true;
      }
      meta[key] = r;
      continue;
    }
    if (!(key in remote)) {
      /* Meta sem valor (documento incompleto): ignora e reenvia o local. */
      remoteBehind = true;
      continue;
    }
    entries[key] = remote[key];
    meta[key] = { at: r.at, h: r.h };
    localChanged = true;
  }

  return { entries, meta, localChanged, remoteBehind };
}

/** Esquece remoções antigas (mantém o documento pequeno). */
export function pruneTombstones(meta: MetaMap, nowMs: number): MetaMap {
  const out: MetaMap = {};
  for (const [key, m] of Object.entries(meta)) {
    if (m.d && nowMs - (Date.parse(m.at) || 0) > TOMBSTONE_TTL_MS) continue;
    out[key] = m;
  }
  return out;
}

/** Meta para entradas vindas do formato antigo (sem meta por chave). */
export function metaFromTimes(
  entries: Entries,
  timeOf: (key: string, value: unknown) => string | undefined,
  removed: Record<string, string> = {},
): MetaMap {
  const meta: MetaMap = {};
  for (const [key, value] of Object.entries(entries)) {
    meta[key] = { at: timeOf(key, value) || EPOCH, h: hashValue(value) };
  }
  for (const [key, at] of Object.entries(removed)) {
    if (!at || key in entries) continue;
    meta[key] = { at, h: "", d: 1 };
  }
  return meta;
}
