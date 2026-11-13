/**
 * Texto de referência cruzada a partir do índice da versão ativa.
 * Inclui todos os versos de um intervalo USFM (ex. LUK.1.10-13).
 * TSKE só fornece a ref — o texto vem sempre da versão ativa (índice ou passagem).
 */

import type { BibleTextVersionId } from "./bibleVersions";
import { fetchPassageForVersion } from "./passageForVersion";
import type { YouVersionPassage } from "../youversion/client";
import { parseUsfmLocation } from "../youversion/usfm";

export type VerseTextByKey = Map<string, string> | ReadonlyMap<string, string>;

export function verseIndexKey(
  bookId: string,
  chapter: number,
  verse: number,
): string {
  return `${bookId.toUpperCase()}.${chapter}.${verse}`;
}

function verseRange(
  usfm: string,
): { bookId: string; chapter: number; start: number; end: number } | null {
  const parsed = parseUsfmLocation(usfm);
  if (!parsed || parsed.verse == null) return null;
  const start = parsed.verse;
  const end =
    parsed.verseEnd != null && parsed.verseEnd >= start
      ? parsed.verseEnd
      : start;
  return {
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    start,
    end,
  };
}

/**
 * Resolve o texto completo da passagem apontada por `usfm`.
 * - Sem verso: string vazia (não expande capítulo).
 * - Com intervalo: junta verse..verseEnd (inclusive).
 * - Versos em falta no mapa: omitidos.
 */
export function passageTextFromIndex(
  usfm: string,
  versesByKey: VerseTextByKey,
): string {
  const range = verseRange(usfm);
  if (!range) return "";

  const parts: string[] = [];
  for (let n = range.start; n <= range.end; n += 1) {
    const text = versesByKey.get(
      verseIndexKey(range.bookId, range.chapter, n),
    );
    const trimmed = String(text || "").trim();
    if (trimmed) parts.push(trimmed);
  }
  return parts.join("\n\n");
}

/** Extrai o texto do intervalo a partir de um passage já carregado (fallback). */
export function passageTextFromPassage(
  usfm: string,
  passage: YouVersionPassage | null | undefined,
): string {
  if (!passage) return "";
  const range = verseRange(usfm);
  const verses = passage.verses ?? [];
  if (range && verses.length) {
    const parts = verses
      .filter((v) => v.number >= range.start && v.number <= range.end)
      .map((v) => String(v.text || "").trim())
      .filter(Boolean);
    if (parts.length) return parts.join("\n\n");
  }
  if (verses.length) {
    return verses
      .map((v) => String(v.text || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return String(passage.content || "").trim();
}

/** Texto da ref na versão ativa: índice → fetch da passagem (capítulo se preciso). */
export async function resolveCrossRefPassageText(
  versionId: BibleTextVersionId,
  usfm: string,
  versesByKey?: VerseTextByKey | null,
): Promise<string> {
  const key = String(usfm || "").trim();
  if (!key) return "";
  if (versesByKey) {
    const fromIndex = passageTextFromIndex(key, versesByKey);
    if (fromIndex) return fromIndex;
  }
  const direct = await fetchPassageForVersion(versionId, key);
  if (direct.ok) {
    const text = passageTextFromPassage(key, direct.passage);
    if (text) return text;
  }
  const parsed = parseUsfmLocation(key);
  if (!parsed || parsed.verse == null) return "";
  const chapterUsfm = `${parsed.bookId}.${parsed.chapter}`;
  if (chapterUsfm === key) return "";
  const chapter = await fetchPassageForVersion(versionId, chapterUsfm);
  if (!chapter.ok) return "";
  return passageTextFromPassage(key, chapter.passage);
}

/**
 * Preenche textos em falta: um fetch por capítulo (várias refs no mesmo cap.
 * partilham a passagem).
 */
export async function hydrateCrossRefTexts(
  versionId: BibleTextVersionId,
  usfms: readonly string[],
  versesByKey?: VerseTextByKey | null,
): Promise<Record<string, string>> {
  const next: Record<string, string> = {};
  const missing: string[] = [];
  for (const raw of usfms) {
    const usfm = String(raw || "").trim();
    if (!usfm) continue;
    const fromIndex = versesByKey
      ? passageTextFromIndex(usfm, versesByKey)
      : "";
    if (fromIndex) {
      next[usfm] = fromIndex;
      continue;
    }
    missing.push(usfm);
  }
  if (!missing.length) return next;

  const byChapter = new Map<string, string[]>();
  for (const usfm of missing) {
    const parsed = parseUsfmLocation(usfm);
    if (!parsed) continue;
    const chapterKey = `${parsed.bookId}.${parsed.chapter}`;
    const list = byChapter.get(chapterKey);
    if (list) list.push(usfm);
    else byChapter.set(chapterKey, [usfm]);
  }

  await Promise.all(
    [...byChapter.entries()].map(async ([chapterUsfm, refs]) => {
      const result = await fetchPassageForVersion(versionId, chapterUsfm);
      if (!result.ok || !result.passage) return;
      for (const usfm of refs) {
        const text = passageTextFromPassage(usfm, result.passage);
        if (text) next[usfm] = text;
      }
    }),
  );
  return next;
}
