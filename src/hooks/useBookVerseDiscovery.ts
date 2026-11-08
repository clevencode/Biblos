import { useEffect, useRef, useState } from "react";
import { searchVersesForVersion } from "../bible/passageForVersion";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import type { BibleSearchHit } from "../youversion/client";

const VERSE_HIT_LIMIT = 48;
const MIN_QUERY = 2;

export function useBookVerseDiscovery(
  query: string,
  bookId: string | null,
  textVersion: BibleTextVersionId,
): { hits: BibleSearchHit[]; total: number; busy: boolean; error: string | null } {
  const [hits, setHits] = useState<BibleSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqGen = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!bookId || trimmed.length < MIN_QUERY) {
      setHits([]);
      setTotal(0);
      setBusy(false);
      setError(null);
      return;
    }

    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);

    void (async () => {
      const res = await searchVersesForVersion(textVersion, trimmed, VERSE_HIT_LIMIT, {
        books: [bookId],
      });
      if (gen !== reqGen.current) return;

      if (!res.ok) {
        setHits([]);
        setTotal(0);
        setError(res.error ?? "Versets indisponibles");
        setBusy(false);
        return;
      }

      setHits(res.results ?? []);
      setTotal(res.total ?? res.results?.length ?? 0);
      setError(null);
      setBusy(false);
    })();
  }, [query, bookId, textVersion]);

  return { hits, total, busy, error };
}
