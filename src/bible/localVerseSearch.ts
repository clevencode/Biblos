/**
 * Facade de busca local em cascata — compartilhada por todas as versões offline.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import { profileForVersion } from "./verseSearchProfiles";
import { ensureVerseIndex } from "./verseIndexCache";
import { makeSearchSnippet } from "./searchSnippet";
import {
  SEARCH_MIN_QUERY_LENGTH,
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

export async function runLocalVerseSearch(input: {
  version: BibleTextVersionId;
  q: string;
  limit?: number;
  offset?: number;
  /** Legado: equivale a `scope: { type: "books" }`. Ignorado quando `scope` está definido. */
  bookFilter?: Iterable<string> | null;
  bookOrder?: Map<string, number>;
  /** Escopo pós-rank (preferido para word-search). */
  scope?: SearchScope;
  /** Livro do leitor — boost de ranking. */
  preferBookId?: string;
}): Promise<LocalVerseSearchResult> {
  const query = String(input.q || "").trim();
  const queryNorm = normalizeSearchText(query);
  if (queryNorm.length < SEARCH_MIN_QUERY_LENGTH) {
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

  let index;
  try {
    index = await ensureVerseIndex(input.version, input.bookOrder);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : input.version === "ht98"
            ? "Catalogue HT98 indisponible"
            : "Index biblique indisponible",
    };
  }
  if (!index.verses.length) {
    return {
      ok: false,
      error:
        input.version === "ht98"
          ? "Catalogue HT98 vide"
          : "Index biblique vide — réessaie après le chargement des livres",
    };
  }
  // bookFilter legado → escopo pós-rank sobre o índice partilhado
  // (antes reconstruía um tokenMap a cada consulta).
  const legacyBooks = input.bookFilter
    ? [...input.bookFilter].map((id) => String(id).toUpperCase()).filter(Boolean)
    : [];
  const scope: SearchScope =
    input.scope ??
    (legacyBooks.length > 0 ? { type: "books", bookIds: legacyBooks } : { type: "all" });

  const found = searchVersesCascadeOnIndex(index, query, {
    limit: input.limit,
    offset: input.offset,
    profile: profileForVersion(input.version),
    scope,
    preferBookId: input.preferBookId,
  });
  // Frase inteira quando casou como frase; senão o 1º termo útil.
  const snippetNeedle =
    found.matchMode === "exact_phrase"
      ? queryNorm
      : (found.matchedTerms.find((t) => t.length >= SEARCH_MIN_QUERY_LENGTH) ?? queryNorm);

  const results: BibleSearchHit[] = found.results.map(({ verse }) => ({
    usfm: verse.usfm,
    bookTitle: verse.bookTitle,
    chapter: verse.chapter,
    verse: verse.verse,
    text: verse.raw,
    snippet: makeSearchSnippet(verse.raw, snippetNeedle),
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
