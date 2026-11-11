import { useCallback, useState } from "react";

export const RECENT_WORD_SEARCHES_KEY = "biblos_word_search_recents_v1";
export const MAX_RECENT_WORD_SEARCHES = 5;

export const WORD_SEARCH_SUGGESTIONS = [
  "amour",
  "foi",
  "grâce",
  "Jean 3.16",
] as const;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_WORD_SEARCHES_KEY);
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

function writeRecents(list: string[]): void {
  try {
    localStorage.setItem(RECENT_WORD_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    /* private mode / quota */
  }
}

export function useRecentWordSearches() {
  const [recents, setRecents] = useState<string[]>(() => readRecents());

  const pushRecent = useCallback((term: string) => {
    const normalized = String(term || "").trim();
    if (normalized.length < 2) return;
    setRecents((prev) => {
      const next = [
        normalized,
        ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, MAX_RECENT_WORD_SEARCHES);
      writeRecents(next);
      return next;
    });
  }, []);

  const chips = recents.length > 0 ? recents : [...WORD_SEARCH_SUGGESTIONS];
  const isSuggestions = recents.length === 0;

  return { recents, chips, isSuggestions, pushRecent };
}
