/**
 * Facade de busca local em cascata — compartilhada por todas as versões offline.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import { profileForVersion } from "./verseSearchProfiles";
import { ensureVerseIndex } from "./verseIndexCache";
import {
  emptySearchFacets,
  normalizeSearchText,
  searchVersesCascadeOnIndex,
  type MatchMode,
  type SearchFacets,
  type SearchScope,
} from "./verseSearchEngine";
import type { BibleSearchHit } from "../youversion/client";

export type LocalVerseSearchOk = {
  ok: true;
  q: string;
  total: number;
  results: BibleSearchHit[];
  bookCounts: Record<string, number>;
  facets: SearchFacets;
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
  /** Legado: pré-filtra o índice. Ignorado quando `scope` está definido. */
  bookFilter?: Iterable<string> | null;
  bookOrder?: Map<string, number>;
  /** Escopo pós-rank (preferido para word-search). */
  scope?: SearchScope;
}): Promise<LocalVerseSearchResult> {
  const query = String(input.q || "").trim();
  const queryNorm = normalizeSearchText(query);
  if (queryNorm.length < 2) {
    const facets = emptySearchFacets();
    return {
      ok: true,
      q: query,
      total: 0,
      results: [],
      bookCounts: facets.byBook,
      facets,
      matchMode: "exact_phrase",
      matchedTerms: [],
    };
  }

  const index = await ensureVerseIndex(input.version, input.bookOrder);
  let searchIndex = index;
  const useScope = Boolean(input.scope);
  if (!useScope && input.bookFilter) {
    const allowed = new Set(
      [...input.bookFilter].map((id) => String(id).toUpperCase()).filter(Boolean),
    );
    if (allowed.size > 0) {
      const { buildTokenIndex } = await import("./verseSearchEngine");
      searchIndex = buildTokenIndex(
        index.verses.filter((v) => allowed.has(v.bookId)),
      );
    }
  }

  const capped = Math.min(80, Math.max(1, Number(input.limit) || 40));
  const found = searchVersesCascadeOnIndex(searchIndex, query, {
    limit: capped,
    profile: profileForVersion(input.version),
    scope: input.scope ?? { type: "all" },
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
    facets: found.facets,
    matchMode: found.matchMode,
    matchedTerms: found.matchedTerms,
  };
}
