import { useEffect, useRef, useState } from "react";
import { searchVersesForVersion } from "../bible/passageForVersion";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import type { MatchMode } from "../bible/verseSearchEngine";
import type { BibleSearchHit } from "../youversion/client";
import { passageJumpsFromQuery } from "../youversion/bibleRefs";

/**
 * Pesquisa por palavras → passagens (ref. 62c757f / BibleSearchSheet):
 * - debounce 280ms
 * - mínimo 2 caracteres
 * - ignora queries que são só referência (jumps)
 * - `searchVersesForVersion(..., 40)` → lista plana com snippet
 * - expõe matchMode / matchedTerms da cascata S21 local
 */
const DEBOUNCE_MS = 280;
const MIN_CHARS = 2;
const HIT_LIMIT = 40;

export function useWordPassageSearch(
  query: string,
  enabled: boolean,
  textVersion: BibleTextVersionId,
): {
  hits: BibleSearchHit[];
  total: number;
  busy: boolean;
  error: string | null;
  matchMode: MatchMode | null;
  matchedTerms: string[];
} {
  const [hits, setHits] = useState<BibleSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<MatchMode | null>(null);
  const [matchedTerms, setMatchedTerms] = useState<string[]>([]);
  const reqGen = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const q = query.trim();
    if (q.length < MIN_CHARS || passageJumpsFromQuery(q).length > 0) {
      reqGen.current += 1;
      setHits([]);
      setTotal(0);
      setError(null);
      setBusy(false);
      setMatchMode(null);
      setMatchedTerms([]);
      return;
    }

    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await searchVersesForVersion(textVersion, q, HIT_LIMIT);
        if (gen !== reqGen.current) return;

        if (!res.ok) {
          setError(res.error || "Recherche indisponible");
          setHits([]);
          setTotal(0);
          setMatchMode(null);
          setMatchedTerms([]);
          setBusy(false);
          return;
        }

        setHits(res.results ?? []);
        setTotal(res.total ?? res.results?.length ?? 0);
        setMatchMode(res.matchMode ?? null);
        setMatchedTerms(res.matchedTerms ?? []);
        setError(null);
        setBusy(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, enabled, textVersion]);

  return { hits, total, busy, error, matchMode, matchedTerms };
}
