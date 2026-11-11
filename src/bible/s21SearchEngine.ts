/**
 * Compat: reexporta o motor genérico + wrapper S21.
 * Preferir `verseSearchEngine` + `verseSearchProfiles`.
 */

export {
  buildIndexedVerse,
  expandSynonyms,
  fuzzyMaxDistance,
  fuzzyTokenMatches,
  levenshtein,
  normalizeFrenchText,
  normalizeSearchText,
  prepareQueryTokens,
  ROMANCE_STEM_SUFFIXES,
  searchVersesCascade,
  stemFrenchToken,
  stemToken,
  tokenAlternatives,
  tokenizeFrench,
  tokenizeQuery,
  type IndexedVerse,
  type MatchMode,
  type S21SearchHit,
  type S21SearchResult,
  type SearchS21Options,
  type SearchVersesCascadeOptions,
  type VerseSearchHit,
  type VerseSearchProfile,
  type VerseSearchResult,
} from "./verseSearchEngine";

import { S21_FR_PROFILE } from "./verseSearchProfiles";
import {
  searchVersesCascade,
  type IndexedVerse,
  type S21SearchResult,
  type SearchS21Options,
} from "./verseSearchEngine";

export function searchS21Verses(
  verses: IndexedVerse[],
  rawQuery: string,
  options?: SearchS21Options,
): S21SearchResult {
  return searchVersesCascade(verses, rawQuery, {
    limit: options?.limit,
    profile: options?.profile ?? S21_FR_PROFILE,
  });
}
