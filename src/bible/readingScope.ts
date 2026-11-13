/**
 * Escopo de leitura por versão/idioma.
 * Toda navegação e histórico devem carregar versionId + language explicitamente.
 */

import {
  bibleVersionDef,
  isBibleTextVersionId,
  type BibleTextVersionId,
} from "./bibleVersions";

export type ReadingPassageRef = {
  versionId: BibleTextVersionId;
  language: string;
  usfm: string;
  chapter: number;
  verse?: number | null;
};

export type ReadingHistoryItem = {
  /** `${versionId}:${usfm}:${chapter}` */
  id: string;
  versionId: BibleTextVersionId;
  language: string;
  /** Ex.: "S21", "KREYÒL" */
  versionBadge: string;
  usfm: string;
  localizedBookName: string;
  chapter: number;
  verse?: number | null;
  timestamp: number;
};

/** Badge curto para UI (histórico, tags). */
export function versionBadgeFor(versionId: BibleTextVersionId): string {
  if (versionId === "ht98") return "KREYÒL";
  return bibleVersionDef(versionId).abbreviation;
}

export function languageForVersion(versionId: BibleTextVersionId): string {
  return bibleVersionDef(versionId).languageCode;
}

export function makeHistoryItemId(
  versionId: BibleTextVersionId,
  usfm: string,
  chapter: number | string,
): string {
  const book = String(usfm || "").trim().toUpperCase();
  const ch = String(chapter || "").trim();
  return `${versionId}:${book}:${ch}`;
}

/** Chave de passagem com escopo de versão. */
export function passageKey(
  versionId: BibleTextVersionId,
  usfm: string,
  chapter: number | string,
): string {
  return makeHistoryItemId(versionId, usfm, chapter);
}

/** Chave de estudo versículo com escopo de versão. */
export function verseStudyKey(
  versionId: BibleTextVersionId,
  usfm: string,
  chapter: number | string,
  verse: number | string,
): string {
  return `${passageKey(versionId, usfm, chapter)}:${String(verse).trim()}`;
}

/** Chave universal USFM (cruzamento entre versões). */
export function universalVerseKey(
  usfm: string,
  chapter: number | string,
  verse: number | string,
): string {
  return `${String(usfm || "").trim().toUpperCase()}:${String(chapter).trim()}:${String(verse).trim()}`;
}

export function parseVersionId(
  value: unknown,
  fallback: BibleTextVersionId = "s21",
): BibleTextVersionId {
  return isBibleTextVersionId(value) ? value : fallback;
}

export function buildReadingPassageRef(input: {
  versionId: BibleTextVersionId;
  usfm: string;
  chapter: number | string;
  verse?: number | null;
}): ReadingPassageRef {
  const usfm = String(input.usfm || "").trim().toUpperCase();
  const chapter = Number(input.chapter);
  return {
    versionId: input.versionId,
    language: languageForVersion(input.versionId),
    usfm,
    chapter: Number.isFinite(chapter) ? chapter : 1,
    verse: input.verse ?? null,
  };
}
