/**
 * Perfis linguísticos do motor de busca, por versão.
 *
 * Chaves e valores já no formato de `normalizeSearchText` (minúsculas, sem
 * acentos, apóstrofos → espaço). Sinónimos são **aditivos**: o termo original
 * continua a ser procurado (união por grupo), nunca substituído.
 */

import type { BibleTextVersionId } from "./bibleVersions";
import {
  ROMANCE_STEM_SUFFIXES,
  type VerseSearchProfile,
} from "./verseSearchEngine";
import { frenchInflections, noInflections } from "./verseSearchVariants";

// ---------------------------------------------------------------------------
// S21 — Segond 21 (francês)
// ---------------------------------------------------------------------------

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

const S21_FR_SYNONYMS: VerseSearchProfile["synonyms"] = {
  jehovah: "eternel",
  yahve: "eternel",
  yahweh: "eternel",
  charite: "amour",
};

export const S21_FR_PROFILE: VerseSearchProfile = {
  stopWords: S21_FR_STOP_WORDS,
  synonyms: S21_FR_SYNONYMS,
  stemSuffixes: ROMANCE_STEM_SUFFIXES,
  /* Plural, feminino e verbos em -er (validados no vocabulário da S21). */
  inflect: frenchInflections,
};

// ---------------------------------------------------------------------------
// HT98 — Bib la 1998 (kreyòl ayisyen)
// ---------------------------------------------------------------------------

/**
 * Palavras gramaticais do crioulo haitiano (artigos, pronomes, marcadores
 * TMA, preposições) + formas contraídas que `normalizeSearchText` isola
 * (`t'ap` → "t ap", `m'a` → "m a", `l'ale` → "l ale").
 * Só são removidas quando a consulta tem outros termos (ver tokenizeQuery).
 */
const HT98_STOP_WORDS = new Set([
  // artigos / determinantes
  "yon",
  "yo",
  "a",
  "an",
  "la",
  "lan",
  "nan",
  "sa",
  // pronomes (forma longa e contraída)
  "mwen",
  "m",
  "ou",
  "w",
  "li",
  "l",
  "nou",
  "n",
  "y",
  // marcadores de tempo/aspeto/modo
  "te",
  "t",
  "ap",
  "ape",
  "pral",
  "va",
  "ava",
  "ta",
  "ka",
  "k",
  "p",
  // conectores / preposições
  "ki",
  "se",
  "pa",
  "pou",
  "ak",
  "ave",
  "sou",
]);

/**
 * Variantes que o leitor digita ↔ grafia efetiva do HT98 (verificadas no
 * `ht1998.json`: Senyè 7342×, Jezi 1467×, Jezikri 249×, Kris 462×).
 */
const HT98_SYNONYMS: VerseSearchProfile["synonyms"] = {
  // Compostos: "Jezi"/"Kris" também devem achar "Jezikri".
  jezi: "jezikri",
  kris: "jezikri",
  // Grafia moderna / francês → grafia HT98
  seye: "senye",
  letenel: "senye",
  eternel: "senye",
  seigneur: "senye",
  jehovah: "senye",
  yahweh: "senye",
  yahve: "senye",
  dieu: "bondye",
  bondie: "bondye",
  jesus: ["jezi", "jezikri"],
  christ: ["kris", "jezikri"],
  lanmou: "renmen",
  amour: "renmen",
};

/**
 * Kreyòl é uma língua isolante (sem flexão verbal/nominal): sem sufixos
 * romance nem formas geradas (noInflections); o início de palavra cobre a
 * pesquisa enquanto se escreve ("renm" → renmen).
 */
export const HT98_PROFILE: VerseSearchProfile = {
  stopWords: HT98_STOP_WORDS,
  synonyms: HT98_SYNONYMS,
  stemSuffixes: [],
  /* Créole: palavras invariáveis (plural « yo », tempo por partículas). */
  inflect: noInflections,
};

export function profileForVersion(id: BibleTextVersionId): VerseSearchProfile {
  return id === "ht98" ? HT98_PROFILE : S21_FR_PROFILE;
}
