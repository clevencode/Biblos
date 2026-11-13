import { useCallback, useEffect, useState } from "react";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { wordSearchSuggestions } from "../bible/wordSearchUi";

export const RECENT_WORD_SEARCHES_KEY = "biblos_word_search_recents_v1";
export const MAX_RECENT_WORD_SEARCHES = 5;

/** @deprecated Preferir wordSearchSuggestions(versionId) */
export const WORD_SEARCH_SUGGESTIONS = [
  "amour",
  "foi",
  "grâce",
  "Jean 3.16",
] as const;

function storageKey(versionId: BibleTextVersionId): string {
  return `${RECENT_WORD_SEARCHES_KEY}:${versionId}`;
}

function readRecents(versionId: BibleTextVersionId): string[] {
  try {
    const raw =
      localStorage.getItem(storageKey(versionId)) ??
      (versionId === "s21"
        ? localStorage.getItem(RECENT_WORD_SEARCHES_KEY)
        : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || "").trim())
      .filter((item) => item.length >= 2)
      .slice(0, MAX_RECENT_WORD_SEARCHES);
  } catch {
    return [];
  }
}

function writeRecents(versionId: BibleTextVersionId, list: string[]): void {
  try {
    localStorage.setItem(storageKey(versionId), JSON.stringify(list));
  } catch {
    /* private mode / quota */
  }
}

export function useRecentWordSearches(versionId: BibleTextVersionId) {
  const [recents, setRecents] = useState<string[]>(() =>
    readRecents(versionId),
  );

  useEffect(() => {
    setRecents(readRecents(versionId));
  }, [versionId]);

  const pushRecent = useCallback(
    (term: string) => {
      const normalized = String(term || "").trim();
      if (normalized.length < 2) return;
      setRecents((prev) => {
        const next = [
          normalized,
          ...prev.filter(
            (item) => item.toLowerCase() !== normalized.toLowerCase(),
          ),
        ].slice(0, MAX_RECENT_WORD_SEARCHES);
        writeRecents(versionId, next);
        return next;
      });
    },
    [versionId],
  );

  const suggestions = wordSearchSuggestions(versionId);
  const chips = recents.length > 0 ? recents : [...suggestions];
  const isSuggestions = recents.length === 0;

  return { recents, chips, isSuggestions, pushRecent };
}
