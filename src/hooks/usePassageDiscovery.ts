import { useEffect, useRef, useState } from "react";
import type { YouVersionBook, BibleSearchHit } from "../youversion/client";
import { searchVersesForVersion } from "../bible/passageForVersion";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import {
  buildPassageDiscoveryResult,
  discoverPassageSync,
  emptyDiscoveryResult,
} from "../bible/passageDiscovery/discoverPassageQuery";
import type { PassageDiscoveryResult } from "../bible/passageDiscovery/types";

const DEBOUNCE_MS = 280;
const MIN_CONTENT_CHARS = 2;
/** Igual à folha de busca unificada — lista de passagens (não só contagens). */
const WORD_HIT_LIMIT = 40;

export type PassageDiscoveryScope = "full" | "books";

export type UsePassageDiscoveryResult = {
  result: PassageDiscoveryResult;
  busy: boolean;
  /** Só preenchido em `scope: "full"` — passagens com snippet. */
  verseHits: BibleSearchHit[];
  verseTotal: number;
};

/**
 * @param scope Obrigatório — `"books"` = catálogo/refs (pill); `"full"` = palavras → passagens.
 */
export function usePassageDiscovery(
  query: string,
  books: YouVersionBook[],
  enabled: boolean,
  textVersion: BibleTextVersionId,
  scope: PassageDiscoveryScope,
): UsePassageDiscoveryResult {
  const [result, setResult] = useState<PassageDiscoveryResult>(() =>
    scope === "full" ? emptyDiscoveryResult(query) : discoverPassageSync(query, books),
  );
  const [busy, setBusy] = useState(false);
  const [verseHits, setVerseHits] = useState<BibleSearchHit[]>([]);
  const [verseTotal, setVerseTotal] = useState(0);
  const reqGen = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const trimmed = query.trim();

    if (scope === "books") {
      setVerseHits([]);
      setVerseTotal(0);
      setResult(discoverPassageSync(trimmed, books));
      setBusy(false);
      return;
    }

    // scope === "full" — pesquisa de palavras → lista de passagens (lógica unificada antiga)
    if (trimmed.length < MIN_CONTENT_CHARS) {
      reqGen.current += 1;
      setResult(emptyDiscoveryResult(trimmed));
      setVerseHits([]);
      setVerseTotal(0);
      setBusy(false);
      return;
    }

    const gen = ++reqGen.current;
    setBusy(true);
    setResult(emptyDiscoveryResult(trimmed));
    setVerseHits([]);
    setVerseTotal(0);

    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await searchVersesForVersion(textVersion, trimmed, WORD_HIT_LIMIT);
        if (gen !== reqGen.current) return;

        if (!res.ok) {
          setResult(
            buildPassageDiscoveryResult(trimmed, books, {
              bookCounts: null,
              contentError: res.error ?? "Recherche indisponible",
              contentOnly: true,
            }),
          );
          setVerseHits([]);
          setVerseTotal(0);
          setBusy(false);
          return;
        }

        const hits = res.results ?? [];
        const bookCounts = res.bookCounts ?? {};
        setVerseHits(hits);
        setVerseTotal(res.total ?? hits.length);
        setResult(
          buildPassageDiscoveryResult(trimmed, books, {
            bookCounts,
            contentError: null,
            contentOnly: true,
          }),
        );
        setBusy(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, books, enabled, textVersion, scope]);

  return { result, busy, verseHits, verseTotal };
}
