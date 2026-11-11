import type { BibleSearchResponse, YouVersionBible } from "../youversion/client";
import { fetchPassage, LSG_BIBLE_ID, searchVerses } from "../youversion/client";
import type { BibleTextVersionId } from "./bibleVersions";
import { HT1998_BIBLE_META, ht1998Passage, ht1998Search } from "./ht1998";

export type VersionedPassageResult = Awaited<ReturnType<typeof fetchPassage>>;

export async function fetchPassageForVersion(
  version: BibleTextVersionId,
  usfm: string,
): Promise<VersionedPassageResult> {
  if (version !== "ht98") {
    return fetchPassage(usfm);
  }
  const local = await ht1998Passage(usfm);
  if (local.ok) {
    return {
      ok: true,
      hasKey: true,
      bibleId: HT1998_BIBLE_META.id,
      bible: HT1998_BIBLE_META,
      usingFallback: false,
      passage: local.passage,
    };
  }
  return {
    ok: false,
    hasKey: true,
    bibleId: HT1998_BIBLE_META.id,
    bible: HT1998_BIBLE_META,
    error: local.error,
  };
}

export async function searchVersesForVersion(
  version: BibleTextVersionId,
  q: string,
  limit = 40,
  options?: {
    books?: string[] | null;
    scope?: import("./verseSearchEngine").SearchScope;
  },
): Promise<BibleSearchResponse> {
  if (version !== "ht98") {
    return searchVerses(q, limit, options);
  }
  const local = await ht1998Search(
    q,
    limit,
    options?.scope ? null : (options?.books ?? null),
    options?.scope,
  );
  if (local.ok) {
    return {
      ok: true,
      hasKey: true,
      bible: HT1998_BIBLE_META satisfies YouVersionBible,
      q: local.q,
      total: local.total,
      results: local.results,
      bookCounts: local.bookCounts,
      facets: local.facets,
      matchMode: local.matchMode,
      matchedTerms: local.matchedTerms,
    };
  }
  return {
    ok: false,
    hasKey: true,
    bible: HT1998_BIBLE_META,
    error: local.error,
  };
}

export function versionedBibleId(version: BibleTextVersionId): number {
  return version === "ht98" ? HT1998_BIBLE_META.id : LSG_BIBLE_ID;
}
