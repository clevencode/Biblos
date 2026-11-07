import { resolveChapterVerseCount } from "../bibleOffline";
import { fetchPassageForVersion } from "./passageForVersion";
import type { BibleTextVersionId } from "./bibleVersions";
import { classifyPassageLoadError } from "./passageLoadError";
import { buildPassageSkeletonSchema } from "./viewState/schema";
import type { PassageSkeletonSchema, PassageViewState } from "./viewState/types";
import { chapterUsfm } from "../youversion/client";
import { parseUsfmParts } from "../youversion/client";

const PERF = typeof performance !== "undefined" && typeof performance.mark === "function";

function perfMark(name: string) {
  if (PERF) performance.mark(name);
}

export async function resolvePassageLayout(input: {
  bookId: string;
  chapterId: string;
  bookTitle: string;
}): Promise<PassageSkeletonSchema> {
  perfMark("passage-layout-start");
  const metrics = await resolveChapterVerseCount(input.bookId, input.chapterId);
  const schema = buildPassageSkeletonSchema({
    bookId: input.bookId,
    chapterId: input.chapterId,
    bookTitle: input.bookTitle,
    verseCount: metrics?.verseCount ?? null,
    contentCharLength: metrics?.contentCharLength ?? null,
  });
  perfMark("passage-layout-end");
  return schema;
}

export async function resolvePassageLayoutFromUsfm(
  usfm: string,
  bookTitle: string,
): Promise<PassageSkeletonSchema> {
  const parts = parseUsfmParts(usfm);
  return resolvePassageLayout({
    bookId: parts.bookId,
    chapterId: parts.chapterId,
    bookTitle,
  });
}

export async function loadPassageViewState(input: {
  version: BibleTextVersionId;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  catalogOffline: boolean;
  offlineIndexReady: boolean;
}): Promise<PassageViewState> {
  const usfm = chapterUsfm(input.bookId, input.chapterId);
  const schema = await resolvePassageLayout({
    bookId: input.bookId,
    chapterId: input.chapterId,
    bookTitle: input.bookTitle,
  });

  perfMark("passage-idb-read-start");
  try {
    const result = await fetchPassageForVersion(input.version, usfm);
    perfMark("passage-idb-read-end");

    if (!result.ok || !result.passage) {
      const errMsg = result.error ?? "Passage introuvable";
      const errorKind = classifyPassageLoadError(errMsg, {
        offline: input.catalogOffline,
        offlineIndexReady: input.offlineIndexReady,
      });
      perfMark("passage-viewstate-error");
      return {
        status: "error",
        schema,
        errorKind,
        message: errMsg,
      };
    }

    perfMark("passage-viewstate-emit");
    return {
      status: "success",
      schema,
      passage: result.passage,
      bibleId: result.bibleId ?? null,
      bible: result.bible ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorKind = classifyPassageLoadError(message, {
      offline: input.catalogOffline,
      offlineIndexReady: input.offlineIndexReady,
    });
    return {
      status: "error",
      schema,
      errorKind,
      message,
    };
  }
}
