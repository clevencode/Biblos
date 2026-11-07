export type StrongLexiconEntry = {
  id: string;
  original?: string;
  transliteration?: string;
  phonetic?: string;
  definition?: string;
  detail?: string;
  detailType?: "bdb" | "thayer";
  partOfSpeech?: string;
};

const cache = new Map<string, StrongLexiconEntry | null>();
const inflight = new Map<string, Promise<StrongLexiconEntry | null>>();

export function normalizeStrongLookupKey(code: string): string {
  const m = /^([GH])(\d+)$/i.exec(String(code || "").trim());
  if (!m) return String(code || "").trim().toUpperCase();
  return `${m[1]!.toUpperCase()}${Number(m[2])}`;
}

export function formatStrongDisplayCode(code: string): string {
  return normalizeStrongLookupKey(code);
}

function urlFor(id: string): string {
  return `/bible/study/strong/${encodeURIComponent(id)}.json`;
}

export async function fetchStrongLexiconEntry(
  code: string,
): Promise<StrongLexiconEntry | null> {
  const id = normalizeStrongLookupKey(code);
  if (!id) return null;
  if (cache.has(id)) return cache.get(id)!;
  let req = inflight.get(id);
  if (!req) {
    req = (async () => {
      try {
        const res = await fetch(urlFor(id));
        if (!res.ok) {
          cache.set(id, null);
          return null;
        }
        const json = (await res.json()) as StrongLexiconEntry;
        if (!json?.id) {
          cache.set(id, null);
          return null;
        }
        cache.set(id, json);
        return json;
      } catch {
        cache.set(id, null);
        return null;
      } finally {
        inflight.delete(id);
      }
    })();
    inflight.set(id, req);
  }
  return req;
}
