import {
  readReadingPrefs,
  writeReadingPrefs,
} from "./bibleCatalogRepository";

export type BibleTextVersionId = "s21" | "ht98";

export type BibleVersionDef = {
  id: BibleTextVersionId;
  abbreviation: string;
  title: string;
  languageCode: string;
  /** Crédito do texto (secção « À propos » do perfil). */
  copyright: string;
};

export const BIBLE_TEXT_VERSIONS: readonly BibleVersionDef[] = [
  {
    id: "s21",
    abbreviation: "S21",
    title: "Segond 21",
    languageCode: "fr",
    copyright: "© 2007 Société Biblique de Genève",
  },
  {
    id: "ht98",
    abbreviation: "HAT98",
    title: "1998 Haïtienne",
    languageCode: "ht",
    copyright: "© 1998 Société Biblique Haïtienne",
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

/** Grava a versão bíblica nas prefs do leitor (idioma UI segue via notifyUiLocale). */
export function writeBibleTextVersionPref(versionId: BibleTextVersionId): void {
  const prefs = readReadingPrefs();
  writeReadingPrefs({ ...prefs, textVersion: versionId });
}

export function bibleVersionDef(id: BibleTextVersionId): BibleVersionDef {
  return BIBLE_TEXT_VERSIONS.find((v) => v.id === id) ?? BIBLE_TEXT_VERSIONS[0]!;
}
