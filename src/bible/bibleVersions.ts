import { readReadingPrefs } from "./bibleCatalogRepository";

export type BibleTextVersionId = "s21" | "ht98";

export type BibleVersionDef = {
  id: BibleTextVersionId;
  abbreviation: string;
  title: string;
  languageCode: string;
};

export const BIBLE_TEXT_VERSIONS: readonly BibleVersionDef[] = [
  {
    id: "s21",
    abbreviation: "S21",
    title: "Segond 21",
    languageCode: "fr",
  },
  {
    id: "ht98",
    abbreviation: "HAT98",
    title: "1998 Haïtienne",
    languageCode: "ht",
  },
] as const;

export function isBibleTextVersionId(value: unknown): value is BibleTextVersionId {
  return value === "s21" || value === "ht98";
}

export function readBibleTextVersionPref(): BibleTextVersionId {
  const prefs = readReadingPrefs();
  if (String(prefs.textVersion || "") === "sg1910") return "s21";
  return isBibleTextVersionId(prefs.textVersion) ? prefs.textVersion : "s21";
}

export function bibleVersionDef(id: BibleTextVersionId): BibleVersionDef {
  return BIBLE_TEXT_VERSIONS.find((v) => v.id === id) ?? BIBLE_TEXT_VERSIONS[0]!;
}
