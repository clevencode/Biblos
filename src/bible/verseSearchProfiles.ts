import type { BibleTextVersionId } from "./bibleVersions";
import {
  ROMANCE_STEM_SUFFIXES,
  type VerseSearchProfile,
} from "./verseSearchEngine";

const S21_FR_STOP_WORDS = new Set([
  "le",
  "la",
  "les",
  "l",
  "de",
  "du",
  "des",
  "d",
  "un",
  "une",
  "et",
  "ou",
  "a",
  "au",
  "aux",
  "en",
  "dans",
  "par",
  "pour",
  "que",
  "qui",
  "qu",
  "il",
  "elle",
  "ils",
  "elles",
  "ne",
  "pas",
  "se",
  "ce",
]);

const S21_FR_SYNONYMS: Record<string, string> = {
  jehovah: "eternel",
  yahve: "eternel",
  yahweh: "eternel",
  charite: "amour",
};

export const S21_FR_PROFILE: VerseSearchProfile = {
  stopWords: S21_FR_STOP_WORDS,
  synonyms: S21_FR_SYNONYMS,
  stemSuffixes: ROMANCE_STEM_SUFFIXES,
};

const HT98_STOP_WORDS = new Set([
  "yon",
  "yo",
  "nan",
  "pou",
  "ak",
  "ki",
  "se",
  "pa",
  "li",
  "nou",
  "mwen",
  "ou",
  "a",
  "an",
  "lan",
  "sou",
]);

export const HT98_PROFILE: VerseSearchProfile = {
  stopWords: HT98_STOP_WORDS,
  synonyms: {},
  stemSuffixes: ROMANCE_STEM_SUFFIXES,
};

export function profileForVersion(id: BibleTextVersionId): VerseSearchProfile {
  return id === "ht98" ? HT98_PROFILE : S21_FR_PROFILE;
}
