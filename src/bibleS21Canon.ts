/**
 * Canon S21 (USFM ↔ OSIS) — alinhado com data/bible/s21/manifest.json e api/youversion.mjs.
 */
import manifest from "../data/bible/s21/manifest.json";
import type { YouVersionBible, YouVersionBook } from "./youversion/client";

export const S21_BIBLE_META: YouVersionBible = {
  id: 0,
  abbreviation: manifest.abbreviation || "S21",
  title: "Segond 21",
  languageCode: manifest.languageCode || "fr",
};

const byUsfm = new Map(
  (manifest.books ?? []).map((row) => [
    String(row.usfm || "")
      .trim()
      .toUpperCase(),
    row,
  ]),
);

export function usfmToOsis(usfm: string): string | null {
  const key = String(usfm || "")
    .trim()
    .toUpperCase()
    .split(".")[0];
  const row = byUsfm.get(key);
  return row?.osis ? String(row.osis) : null;
}

export function buildS21BookList(): YouVersionBook[] {
  return (manifest.books ?? []).map((row) => {
    const id = String(row.usfm || "").trim().toUpperCase();
    const title = String(row.title || id);
    const chapterCount = Number(row.chapters) || 1;
    return {
      id,
      title,
      fullTitle: title,
      abbreviation: id,
      chapters: Array.from({ length: chapterCount }, (_, i) => {
        const chap = String(i + 1);
        return { id: chap, passageId: `${id}.${chap}`, title: null };
      }),
    };
  });
}

/** URL estática servida pelo bundle (public/bible/s21 após stage-bible-assets). */
export function bundledBookAssetUrl(usfm: string): string | null {
  const osis = usfmToOsis(usfm);
  if (!osis) return null;
  return `/bible/s21/books/${osis}.json`;
}

export type S21BookJson = {
  version?: string;
  book?: string;
  usfm?: string;
  title?: string;
  chapters: {
    chapter: number;
    verses: { number: number; text: string }[];
  }[];
};

export async function fetchBundledBookJson(usfm: string): Promise<S21BookJson | null> {
  const url = bundledBookAssetUrl(usfm);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as S21BookJson;
    if (!json?.chapters?.length) return null;
    return json;
  } catch {
    return null;
  }
}
