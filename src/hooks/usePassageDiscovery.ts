import { useEffect, useRef, useState } from "react";
import type { YouVersionBook } from "../youversion/client";
import { searchVersesForVersion } from "../bible/passageForVersion";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import {
  buildDiscoveryJumps,
  buildPassageDiscoveryResult,
  discoverPassageSync,
} from "../bible/passageDiscovery/discoverPassageQuery";
import type { PassageDiscoveryResult } from "../bible/passageDiscovery/types";

const DEBOUNCE_MS = 280;
const MIN_CONTENT_CHARS = 2;

export type PassageDiscoveryScope = "full" | "books";

export function usePassageDiscovery(
  query: string,
  books: YouVersionBook[],
  enabled: boolean,
  textVersion: BibleTextVersionId,
  scope: PassageDiscoveryScope = "full",
): { result: PassageDiscoveryResult; busy: boolean } {
  const [result, setResult] = useState<PassageDiscoveryResult>(() =>
    discoverPassageSync(query, books),
  );
  const [busy, setBusy] = useState(false);
  const reqGen = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const trimmed = query.trim();
    const sync = discoverPassageSync(trimmed, books);
    setResult(sync);

    if (!trimmed) {
      setBusy(false);
      return;
    }

    if (buildDiscoveryJumps(trimmed).length > 0) {
      setBusy(false);
      return;
    }

    if (scope === "books") {
      setBusy(false);
      return;
    }

    if (trimmed.length < MIN_CONTENT_CHARS) {
      setBusy(false);
      return;
    }

    const gen = ++reqGen.current;
    setBusy(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await searchVersesForVersion(textVersion, trimmed, 1);
        if (gen !== reqGen.current) return;

        const contentError = res.ok ? null : res.error ?? "Recherche indisponible";
        const bookCounts = res.ok ? res.bookCounts ?? {} : {};

        setResult(
          buildPassageDiscoveryResult(trimmed, books, {
            bookCounts,
            contentError,
          }),
        );
        setBusy(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, books, enabled, textVersion, scope]);

  return { result, busy };
}
