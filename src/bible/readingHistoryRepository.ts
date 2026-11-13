/**
 * Repositório de histórico de leitura com isolamento por versão.
 * Lê/escreve via activityLog (localStorage), tipado como ReadingHistoryItem.
 */

import {
  listBibleReadingHistory,
  type ActivityEvent,
} from "../activityLog";
import {
  languageForVersion,
  makeHistoryItemId,
  parseVersionId,
  versionBadgeFor,
  type ReadingHistoryItem,
} from "./readingScope";
import type { BibleTextVersionId } from "./bibleVersions";

function metaString(
  meta: ActivityEvent["meta"],
  key: string,
): string {
  const raw = meta?.[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function metaNumber(
  meta: ActivityEvent["meta"],
  key: string,
): number | null {
  const raw = meta?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Converte evento legado/novo → ReadingHistoryItem (fallback versionId = s21). */
export function toReadingHistoryItem(
  event: ActivityEvent,
): ReadingHistoryItem | null {
  const bookId = metaString(event.meta, "bookId").toUpperCase();
  const chapterRaw =
    metaString(event.meta, "chapterId") ||
    String(metaNumber(event.meta, "chapter") ?? "");
  if (!bookId || !chapterRaw) return null;

  const chapter = Number(chapterRaw);
  if (!Number.isFinite(chapter) || chapter < 1) return null;

  const versionId = parseVersionId(event.meta?.versionId, "s21");
  const language =
    metaString(event.meta, "language") || languageForVersion(versionId);
  const badgeRaw = metaString(event.meta, "versionBadge");
  const localizedBookName =
    metaString(event.meta, "localizedBookName") || bookId;
  const verse = metaNumber(event.meta, "verse");

  return {
    id: makeHistoryItemId(versionId, bookId, chapter),
    versionId,
    language,
    versionBadge: badgeRaw || versionBadgeFor(versionId),
    usfm: bookId,
    localizedBookName,
    chapter,
    verse,
    timestamp: Date.parse(event.at) || Date.now(),
  };
}

export function listReadingHistory(
  userId?: string,
  limit = 40,
): ReadingHistoryItem[] {
  return listBibleReadingHistory(userId, limit)
    .map(toReadingHistoryItem)
    .filter((item): item is ReadingHistoryItem => item != null);
}

export function readingLabelForItem(item: ReadingHistoryItem): string {
  const book = item.localizedBookName || item.usfm;
  return item.verse != null
    ? `${book} ${item.chapter}.${item.verse}`
    : `${book} ${item.chapter}`;
}

export type HistorySelectPayload = {
  versionId: BibleTextVersionId;
  bookId: string;
  chapterId: string;
  verse: number | null;
};
