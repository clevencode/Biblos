import { parseUsfmLocation, toUsfm, type ParsedPassage } from "../youversion/usfm";
import { CANON_BOOKS } from "../youversion/canon";
import { passageJumpsFromQuery } from "../youversion/bibleRefs";

export type TskeVerseBlock = {
  heading?: string;
  body?: string;
  refs: TskeRef[];
};

export type TskeRef = {
  label: string;
  usfm: string | null;
};

type TskeChapterJson = Record<
  string,
  { heading?: string; body?: string; refs?: string[] }
>;

const chapterCache = new Map<string, TskeChapterJson>();

function chapterUrl(bookId: string, chapter: number): string {
  return `/bible/study/tske/${encodeURIComponent(bookId)}.${chapter}.json`;
}

function bookTitle(bookId: string): string {
  const book = CANON_BOOKS.find((b) => b.id === bookId.toUpperCase());
  return book?.title ?? bookId;
}

function formatJump(jump: ParsedPassage): string {
  const title = bookTitle(jump.bookId);
  if (jump.verse == null) return `${title} ${jump.chapter}`;
  if (jump.verseEnd != null && jump.verseEnd !== jump.verse) {
    return `${title} ${jump.chapter}.${jump.verse}-${jump.verseEnd}`;
  }
  return `${title} ${jump.chapter}.${jump.verse}`;
}

/**
 * Resolve um chunk TSK.
 * `lineBook` = livro herdado na mesma linha (ex. após « Psa 33:6 ; 104:30 »).
 * Refs nuas « 104:30 » só usam `lineBook` — nunca o livro do versículo de estudo
 * (senão GEN 1:2 + « 104:30 » vira Genèse 104.30).
 */
function jumpsFromChunk(
  chunk: string,
  lineBook: string | null,
  contextBook: string,
  contextChapter: number,
): ParsedPassage[] {
  const trimmed = String(chunk || "").trim();
  if (!trimmed) return [];
  const direct = passageJumpsFromQuery(trimmed);
  if (direct.length) return direct;
  // « 104:30 » / « 104.30 » — capítulo:verso do livro já citado na linha
  if (/^\d{1,3}[:.]\d/.test(trimmed)) {
    if (!lineBook) return [];
    const loc = parseUsfmLocation(
      toUsfm(`${lineBook} ${trimmed.replace(".", ":")}`),
    );
    return loc ? [loc] : [];
  }
  // « 3, 5 » — versículos do capítulo de estudo (mesmo livro)
  if (/^\d{1,3},\s*\d/.test(trimmed)) {
    const loc = parseUsfmLocation(
      toUsfm(`${lineBook ?? contextBook} ${contextChapter}.${trimmed.replace(",", ".")}`),
    );
    return loc ? [loc] : [];
  }
  return [];
}

export function parseTskeBody(body: string, contextBook: string, contextChapter: number): TskeRef[] {
  const out: TskeRef[] = [];
  const seen = new Set<string>();
  for (const line of String(body || "").split("\n")) {
    /** Só herda livro após um jump com livro explícito na linha. */
    let lineBook: string | null = null;
    for (const part of line.split(";")) {
      const piece = part.trim();
      if (!piece) continue;
      if (piece.endsWith(":") && !/\d:\d/.test(piece)) continue;
      if (/^Reciprocal:/i.test(piece)) continue;
      if (/^Heb\./i.test(piece)) continue;
      if (/^Or,/i.test(piece)) continue;
      const jumps = jumpsFromChunk(
        piece,
        lineBook,
        contextBook,
        contextChapter,
      );
      if (!jumps.length) continue;
      lineBook = jumps[jumps.length - 1]!.bookId;
      for (const jump of jumps) {
        const key = jump.usfm;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ label: formatJump(jump), usfm: key });
      }
    }
  }
  return out;
}

export async function loadTskeChapter(
  bookId: string,
  chapter: number,
): Promise<TskeChapterJson | null> {
  const book = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!book || !Number.isFinite(ch) || ch < 0) return null;
  const key = `${book}.${ch}`;
  if (chapterCache.has(key)) return chapterCache.get(key)!;

  // Assets embutidos (APK / Vite public) ou Cache Storage — sem IndexedDB.
  try {
    const res = await fetch(chapterUrl(book, ch));
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    // SPA/HTML fallback quando o JSON TSKE não existe.
    if (!raw || raw.startsWith("<")) return null;
    const json = JSON.parse(raw) as TskeChapterJson;
    if (!json || typeof json !== "object") return null;
    chapterCache.set(key, json);
    return json;
  } catch {
    return null;
  }
}

export async function fetchTskeForVerse(
  bookId: string,
  chapter: number,
  verse: number,
): Promise<TskeVerseBlock | null> {
  const data = await loadTskeChapter(bookId, chapter);
  if (!data) return null;
  const block = data[String(verse)];
  if (!block) return null;
  const refs = parseTskeBody(block.body ?? "", bookId, chapter);
  return {
    heading: block.heading,
    body: block.body,
    refs,
  };
}
