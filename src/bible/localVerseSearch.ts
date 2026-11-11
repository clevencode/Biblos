/**
 * Facade de busca local em cascata — compartilhada por todas as versões offline.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import { profileForVersion } from "./verseSearchProfiles";
import { ensureVerseIndex } from "./verseIndexCache";
import {
  normalizeSearchText,
  searchVersesCascade,
  type MatchMode,
} from "./verseSearchEngine";
import type { BibleSearchHit } from "../youversion/client";

export type LocalVerseSearchOk = {
  ok: true;
  q: string;
  total: number;
  results: BibleSearchHit[];
  bookCounts: Record<string, number>;
  matchMode: MatchMode;
  matchedTerms: string[];
};

export type LocalVerseSearchErr = {
  ok: false;
  error: string;
};

export type LocalVerseSearchResult = LocalVerseSearchOk | LocalVerseSearchErr;

function makeSnippet(
  text: string,
  needleNorm: string,
  radius = 60,
): string {
  const raw = String(text || "");
  const norm = normalizeSearchText(raw);
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

export async function runLocalVerseSearch(input: {
  version: BibleTextVersionId;
  q: string;
  limit?: number;
  bookFilter?: Iterable<string> | null;
  bookOrder?: Map<string, number>;
}): Promise<LocalVerseSearchResult> {
  const query = String(input.q || "").trim();
  const queryNorm = normalizeSearchText(query);
  if (queryNorm.length < 2) {
    return {
      ok: true,
      q: query,
      total: 0,
      results: [],
      bookCounts: {},
      matchMode: "exact_phrase",
      matchedTerms: [],
    };
  }

  let verses = await ensureVerseIndex(input.version, input.bookOrder);
  const allowed = input.bookFilter
    ? new Set(
        [...input.bookFilter].map((id) => String(id).toUpperCase()).filter(Boolean),
      )
    : null;
  if (allowed) {
    verses = verses.filter((v) => allowed.has(v.bookId));
  }

  const capped = Math.min(80, Math.max(1, Number(input.limit) || 40));
  const found = searchVersesCascade(verses, query, {
    limit: capped,
    profile: profileForVersion(input.version),
  });
  const snippetNeedle =
    found.matchedTerms.find((t) => t.length >= 2) ?? queryNorm;

  const results: BibleSearchHit[] = found.results.map(({ verse }) => ({
    usfm: verse.usfm,
    bookTitle: verse.bookTitle,
    chapter: verse.chapter,
    verse: verse.verse,
    text: verse.raw,
    snippet: makeSnippet(verse.raw, snippetNeedle),
  }));

  return {
    ok: true,
    q: query,
    total: found.totalCount,
    results,
    bookCounts: found.bookCounts,
    matchMode: found.matchMode,
    matchedTerms: found.matchedTerms,
  };
}
