/**
 * Citations bibliques — norme internationale (FR) :
 * Livre · chapitre · :/. · plage - · versets , · chapitres Livre 3–4 · ; entre unités
 *
 * Exemples :
 * - Jean 3:16 / Jean 3.16
 * - Jean 3:16-18
 * - Jean 3:16, 18, 21
 * - Jean 3–4
 * - Jean 3:16; 5:24
 * - Rm 6, Rm 8
 */

import { foldBookKey, knownBookCode, toUsfm } from "./usfm";

const BOOK =
  "(?:[123]\\s+)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\\-]*(?:\\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\\-]*){0,4}";

const MAJOR_SPLIT = /\s*(?:[;•·|]|\n|\/)\s*/u;

function clean(raw: string): string {
  return String(raw || "")
    .replace(/\*\*/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function ref(
  book: string,
  chapter: number,
  verseStart?: number | null,
  verseEnd?: number | null,
): string {
  if (verseStart == null) return `${book} ${chapter}`;
  if (verseEnd != null && verseEnd !== verseStart) {
    return `${book} ${chapter}:${verseStart}-${verseEnd}`;
  }
  return `${book} ${chapter}:${verseStart}`;
}

function validRef(label: string): boolean {
  const bookPart = label.match(new RegExp(`^(${BOOK})\\s+\\d`, "u"));
  if (!bookPart || !knownBookCode(bookPart[1]!.trim())) return false;
  return /^[A-Z0-9]{2,3}\.\d+/i.test(toUsfm(label));
}

type Ctx = { book: string | null; chapter: number | null; afterVerse: boolean };

/**
 * Développe une chaîne de citations en références atomiques affichables.
 */
export function expandBibleCitations(raw: string): string[] {
  const text = clean(raw);
  if (!text) return [];
  if (/^(objectif|question|semaine|comment|grande|introduction|defi|défi|texte|jour|day)\b/i.test(text)) {
    return [];
  }

  const majors = text.split(MAJOR_SPLIT).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  const ctx: Ctx = { book: null, chapter: null, afterVerse: false };

  for (const major of majors.length ? majors : [text]) {
    expandMajor(major, ctx, out, seen);
  }
  return out;
}

function add(out: string[], seen: Set<string>, label: string): void {
  if (!validRef(label)) return;
  const key = foldBookKey(label);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(label);
}

function expandMajor(
  major: string,
  ctx: Ctx,
  out: string[],
  seen: Set<string>,
): void {
  const parts = clean(major)
    .split(/\s*,\s*/u)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    // « 18 » — verset du même chapitre
    if (/^\d+$/.test(part) && ctx.book && ctx.chapter != null && ctx.afterVerse) {
      add(out, seen, ref(ctx.book, ctx.chapter, Number(part)));
      continue;
    }

    // « 4 » — autre chapitre du même livre (après « Jean 3 »)
    if (/^\d+$/.test(part) && ctx.book && !ctx.afterVerse) {
      ctx.chapter = Number(part);
      add(out, seen, ref(ctx.book, ctx.chapter));
      continue;
    }

    // Livre ch-ch2
    const span = part.match(new RegExp(`^(${BOOK})\\s+(\\d+)\\s*-\\s*(\\d+)$`, "u"));
    if (span && knownBookCode(span[1]!.trim()) && !/[.:]/.test(part)) {
      const book = span[1]!.trim();
      const a = Number(span[2]);
      const b = Number(span[3]);
      if (a >= 1 && b >= a && b - a <= 50) {
        for (let ch = a; ch <= b; ch += 1) add(out, seen, ref(book, ch));
        ctx.book = book;
        ctx.chapter = b;
        ctx.afterVerse = false;
        continue;
      }
    }

    // Livre ch:v-v2 | Livre ch.v | Livre ch
    const full = part.match(
      new RegExp(`^(${BOOK})\\s+(\\d+)(?:[.:](\\d+)(?:\\s*-\\s*(\\d+))?)?$`, "u"),
    );
    if (full && knownBookCode(full[1]!.trim())) {
      const book = full[1]!.trim();
      const chapter = Number(full[2]);
      const v1 = full[3] ? Number(full[3]) : null;
      const v2 = full[4] ? Number(full[4]) : v1;
      add(out, seen, ref(book, chapter, v1, v2));
      ctx.book = book;
      ctx.chapter = chapter;
      ctx.afterVerse = v1 != null;
      continue;
    }

    // Héritage : « 5:24 » / « 5.1-3 » / « 5 »
    const bare = part.match(/^(\d+)(?:[.:](\d+)(?:\s*-\s*(\d+))?)?$/);
    if (bare && ctx.book) {
      const chapter = Number(bare[1]);
      const v1 = bare[2] ? Number(bare[2]) : null;
      const v2 = bare[3] ? Number(bare[3]) : v1;
      add(out, seen, ref(ctx.book, chapter, v1, v2));
      ctx.chapter = chapter;
      ctx.afterVerse = v1 != null;
    }
  }
}
