import type { BibleTextVersionId } from "../bibleVersions";
import type { MatchMode, SearchFacets, SearchScope } from "../verseSearchEngine";
import type { BibleSearchHit } from "../../youversion/client";
import type { SqliteFtsBackend } from "./sqliteFtsGate";

export type SqliteFtsInbound =
  | {
      type: "init";
      requestId: number;
      preferOpfs: boolean;
    }
  | {
      type: "warm";
      requestId: number;
      versionId: BibleTextVersionId;
    }
  | {
      type: "invalidate";
      requestId: number;
      versionId?: BibleTextVersionId;
    }
  | {
      type: "search";
      requestId: number;
      versionId: BibleTextVersionId;
      q: string;
      limit: number;
      offset?: number;
      scope?: SearchScope;
      preferBookId?: string;
    };

export type SqliteFtsOutbound =
  | {
      type: "initResult";
      requestId: number;
      ok: true;
      backend: SqliteFtsBackend;
      libVersion: string;
    }
  | {
      type: "initResult";
      requestId: number;
      ok: false;
      error: string;
      backend: SqliteFtsBackend;
    }
  | {
      type: "warmDone";
      requestId: number;
      versionId: BibleTextVersionId;
      verseCount: number;
    }
  | {
      type: "searchResult";
      requestId: number;
      ok: true;
      q: string;
      total: number;
      results: BibleSearchHit[];
      bookCounts: Record<string, number>;
      facets: SearchFacets;
      matchMode: MatchMode;
      matchedTerms: string[];
    }
  | {
      type: "searchResult";
      requestId: number;
      ok: false;
      error: string;
    }
  | {
      type: "error";
      requestId?: number;
      message: string;
    };
