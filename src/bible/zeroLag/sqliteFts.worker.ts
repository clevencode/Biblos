/// <reference lib="webworker" />
/**
 * Worker SQLite WASM + FTS5 — fora da main thread.
 * OPFS quando disponível; senão DB em memória (+ rebuild no warm).
 */

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { BibleTextVersionId } from "../bibleVersions";
import { ensureVerseIndex, invalidateVerseIndex } from "../verseIndexCache";
import {
  emptySearchFacets,
  normalizeSearchText,
  type SearchScope,
} from "../verseSearchEngine";
import type { SqliteFtsBackend } from "./sqliteFtsGate";
import type { SqliteFtsInbound, SqliteFtsOutbound } from "./sqliteFtsTypes";

const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope;

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;
type Db = InstanceType<Sqlite3["oo1"]["DB"]>;

let sqlite3: Sqlite3 | null = null;
let db: Db | null = null;
let backend: SqliteFtsBackend = "disabled";
let readyVersion: BibleTextVersionId | null = null;
let latestSearchId = 0;

const IDB_NAME = "biblos-sqlite-fts";
const IDB_STORE = "db";

function post(msg: SqliteFtsOutbound): void {
  ctx.postMessage(msg);
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb_open"));
  });
}

async function idbPut(key: string, value: Uint8Array): Promise<void> {
  const database = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb_put"));
  });
}

function ensureSchema(database: Db): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
      usfm UNINDEXED,
      book_id UNINDEXED,
      book_title UNINDEXED,
      chapter UNINDEXED,
      verse UNINDEXED,
      body,
      tokenize = 'unicode61 remove_diacritics 2'
    );
  `);
}

function usfmId(canonIndex: number, chapter: number, verse: number): number {
  return canonIndex * 1_000_000 + chapter * 1_000 + verse;
}

function escapeFtsToken(token: string): string {
  return `"${token.replace(/"/g, '""')}"`;
}

function buildFtsQuery(q: string): { match: string; terms: string[] } {
  const norm = normalizeSearchText(q);
  const terms = norm.split(/\s+/).filter((t) => t.length >= 2);
  if (terms.length === 0) return { match: "", terms: [] };
  if (terms.length === 1) {
    return { match: escapeFtsToken(terms[0]!), terms };
  }
  return {
    match: terms.map(escapeFtsToken).join(" AND "),
    terms,
  };
}

function scopeSql(scope: SearchScope | undefined): {
  clause: string;
  binds: string[];
} {
  if (!scope || scope.type === "all") return { clause: "", binds: [] };
  if (scope.type === "books") {
    if (!scope.bookIds.length) return { clause: "", binds: [] };
    const placeholders = scope.bookIds.map(() => "?").join(",");
    return {
      clause: ` AND book_id IN (${placeholders})`,
      binds: scope.bookIds.map((id) => String(id).toUpperCase()),
    };
  }
  const key =
    scope.type === "ot"
      ? "set:ot"
      : scope.type === "nt"
        ? "set:nt"
        : "set:dc";
  return {
    clause: ` AND EXISTS (
      SELECT 1 FROM meta m WHERE m.key = ? AND instr(',' || m.value || ',', ',' || book_id || ',') > 0
    )`,
    binds: [key],
  };
}

async function openDatabase(preferOpfs: boolean): Promise<{
  database: Db;
  backend: SqliteFtsBackend;
}> {
  if (!sqlite3) throw new Error("sqlite_not_init");

  const canOpfs =
    preferOpfs &&
    "opfs" in sqlite3 &&
    typeof (sqlite3 as { oo1: { OpfsDb?: unknown } }).oo1.OpfsDb === "function";

  if (canOpfs) {
    try {
      const OpfsDb = (sqlite3 as Sqlite3 & { oo1: { OpfsDb: new (f: string) => Db } })
        .oo1.OpfsDb;
      const database = new OpfsDb("/biblos-fts.sqlite3");
      ensureSchema(database);
      return { database, backend: "opfs" };
    } catch {
      /* fall through */
    }
  }

  // Sem OPFS: memória no worker + snapshot opcional via export (rebuild no warm se vazio).
  const database = new sqlite3.oo1.DB("/biblos-fts-mem.sqlite3", "c");
  ensureSchema(database);
  return { database, backend: "idb-fallback" };
}

async function persistIfNeeded(): Promise<void> {
  if (!db || !sqlite3 || backend !== "idb-fallback") return;
  try {
    const ptr = db.pointer;
    if (ptr == null) return;
    const bytes = sqlite3.capi.sqlite3_js_db_export(ptr);
    if (bytes?.byteLength) await idbPut("snapshot", bytes);
  } catch {
    /* quota / private mode */
  }
}

async function warmVersion(versionId: BibleTextVersionId): Promise<number> {
  if (!db) throw new Error("db_closed");
  const index = await ensureVerseIndex(versionId);
  const { OT_BOOK_SET, NT_BOOK_SET, DC_BOOK_SET } = await import(
    "../searchTestamentSets"
  );

  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM verses_fts");
    db.exec("DELETE FROM meta WHERE key LIKE 'set:%' OR key = 'version'");

    const insertFts = db.prepare(`
      INSERT INTO verses_fts (rowid, usfm, book_id, book_title, chapter, verse, body)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      for (const v of index.verses) {
        const id = usfmId(v.canonIndex, v.chapter, v.verse);
        insertFts.bind([
          id,
          v.usfm,
          v.bookId,
          v.bookTitle,
          v.chapter,
          v.verse,
          v.raw,
        ]);
        insertFts.step();
        insertFts.reset();
      }
    } finally {
      insertFts.finalize();
    }

    const ot = [...OT_BOOK_SET].join(",");
    const nt = [...NT_BOOK_SET].join(",");
    const dc = [...DC_BOOK_SET].join(",");
    db.exec({
      sql: "INSERT INTO meta (key, value) VALUES (?, ?), (?, ?), (?, ?), (?, ?)",
      bind: [
        "set:ot",
        ot,
        "set:nt",
        nt,
        "set:dc",
        dc,
        "version",
        versionId,
      ],
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  readyVersion = versionId;
  await persistIfNeeded();
  return index.verses.length;
}

function makeSnippet(text: string, needle: string, radius = 60): string {
  const raw = String(text || "");
  const norm = normalizeSearchText(raw);
  const needleNorm = normalizeSearchText(needle);
  const idx = needleNorm ? norm.indexOf(needleNorm) : -1;
  if (idx < 0) {
    return raw.length > radius * 2 ? `${raw.slice(0, radius * 2).trim()}…` : raw;
  }
  const ratio = raw.length / Math.max(1, norm.length);
  const center = Math.round(idx * ratio);
  const start = Math.max(0, center - radius);
  const end = Math.min(raw.length, center + needleNorm.length * ratio + radius);
  const slice = raw.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < raw.length ? "…" : ""}`;
}

function searchDb(input: {
  versionId: BibleTextVersionId;
  q: string;
  limit: number;
  offset: number;
  scope?: SearchScope;
  preferBookId?: string;
}): {
  total: number;
  results: {
    usfm: string;
    bookTitle: string;
    chapter: number;
    verse: number;
    text: string;
    snippet: string;
  }[];
  bookCounts: Record<string, number>;
  facets: ReturnType<typeof emptySearchFacets>;
  matchedTerms: string[];
  matchMode: "exact_phrase" | "all_terms";
} {
  if (!db) throw new Error("db_closed");
  if (readyVersion !== input.versionId) {
    throw new Error("index_not_warm");
  }

  const { match, terms } = buildFtsQuery(input.q);
  if (!match) {
    return {
      total: 0,
      results: [],
      bookCounts: {},
      facets: emptySearchFacets(),
      matchedTerms: [],
      matchMode: "exact_phrase",
    };
  }

  const scope = scopeSql(input.scope);
  const prefer = String(input.preferBookId || "")
    .trim()
    .toUpperCase();

  const countSql = `
    SELECT COUNT(*) AS c
    FROM verses_fts
    WHERE verses_fts MATCH ?${scope.clause}
  `;
  const totalRow = db.selectObject(countSql, [
    match,
    ...(scope.binds as (string | number)[]),
  ]) as { c: number } | undefined;
  const total = Number(totalRow?.c ?? 0);

  const facetSql = `
    SELECT book_id AS book_id, COUNT(*) AS c
    FROM verses_fts
    WHERE verses_fts MATCH ?
    GROUP BY book_id
  `;
  const facetRows = db.selectObjects(facetSql, [match]) as Array<{
    book_id: string;
    c: number;
  }>;
  const byBook: Record<string, number> = {};
  for (const row of facetRows) {
    const id = String(row.book_id || "").toUpperCase();
    byBook[id] = Number(row.c) || 0;
  }
  const readSet = (key: string): Set<string> => {
    const row = db!.selectObject("SELECT value FROM meta WHERE key = ?", [
      key,
    ]) as { value?: string } | undefined;
    const raw = String(row?.value || "");
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
  };
  const ot = readSet("set:ot");
  const nt = readSet("set:nt");
  const dc = readSet("set:dc");
  let otCount = 0;
  let ntCount = 0;
  let dcCount = 0;
  for (const [id, c] of Object.entries(byBook)) {
    if (ot.has(id)) otCount += c;
    else if (nt.has(id)) ntCount += c;
    else if (dc.has(id)) dcCount += c;
  }
  const facets = {
    total: Object.values(byBook).reduce((a, b) => a + b, 0),
    otCount,
    ntCount,
    dcCount,
    byBook,
  };

  const orderPrefer = prefer
    ? `CASE WHEN book_id = ? THEN 0 ELSE 1 END,`
    : "";
  const bindPrefer = prefer ? [prefer] : [];

  const listSql = `
    SELECT usfm AS usfm, book_title AS book_title, chapter AS chapter,
           verse AS verse, body AS body
    FROM verses_fts
    WHERE verses_fts MATCH ?${scope.clause}
    ORDER BY ${orderPrefer} rowid
    LIMIT ? OFFSET ?
  `;
  const rows = db.selectObjects(listSql, [
    match,
    ...(scope.binds as (string | number)[]),
    ...bindPrefer,
    input.limit,
    input.offset,
  ] as (string | number)[]) as Array<{
    usfm: string;
    book_title: string;
    chapter: number;
    verse: number;
    body: string;
  }>;

  const needle = terms[0] ?? input.q;
  const results = rows.map((row) => ({
    usfm: row.usfm,
    bookTitle: row.book_title,
    chapter: Number(row.chapter),
    verse: Number(row.verse),
    text: row.body,
    snippet: makeSnippet(row.body, needle),
  }));

  return {
    total,
    results,
    bookCounts: byBook,
    facets,
    matchedTerms: terms,
    matchMode: terms.length <= 1 ? "exact_phrase" : "all_terms",
  };
}

ctx.onmessage = (event: MessageEvent<SqliteFtsInbound>) => {
  const msg = event.data;
  void (async () => {
    try {
      if (msg.type === "init") {
        try {
          sqlite3 = await sqlite3InitModule();
          const opened = await openDatabase(msg.preferOpfs);
          db = opened.database;
          backend = opened.backend;
          post({
            type: "initResult",
            requestId: msg.requestId,
            ok: true,
            backend,
            libVersion: sqlite3.version.libVersion,
          });
        } catch (err) {
          backend = "disabled";
          post({
            type: "initResult",
            requestId: msg.requestId,
            ok: false,
            backend,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      if (msg.type === "invalidate") {
        invalidateVerseIndex(msg.versionId);
        if (!msg.versionId || msg.versionId === readyVersion) {
          readyVersion = null;
          if (db) {
            db.exec("DELETE FROM verses_fts;");
          }
        }
        return;
      }

      if (msg.type === "warm") {
        if (!db) throw new Error("db_closed");
        const count = await warmVersion(msg.versionId);
        post({
          type: "warmDone",
          requestId: msg.requestId,
          versionId: msg.versionId,
          verseCount: count,
        });
        return;
      }

      if (msg.type === "search") {
        latestSearchId = msg.requestId;
        if (!db) throw new Error("db_closed");
        if (readyVersion !== msg.versionId) {
          await warmVersion(msg.versionId);
        }
        const found = searchDb({
          versionId: msg.versionId,
          q: msg.q,
          limit: msg.limit,
          offset: msg.offset ?? 0,
          scope: msg.scope,
          preferBookId: msg.preferBookId,
        });
        if (msg.requestId !== latestSearchId) return;
        post({
          type: "searchResult",
          requestId: msg.requestId,
          ok: true,
          q: msg.q,
          total: found.total,
          results: found.results,
          bookCounts: found.bookCounts,
          facets: found.facets,
          matchMode: found.matchMode,
          matchedTerms: found.matchedTerms,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (msg.type === "search") {
        post({
          type: "searchResult",
          requestId: msg.requestId,
          ok: false,
          error: message,
        });
        return;
      }
      post({ type: "error", requestId: "requestId" in msg ? msg.requestId : undefined, message });
    }
  })();
};
