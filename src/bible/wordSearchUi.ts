/**
 * Copy do Search Modal por idioma da versão ativa (fr | ht).
 */

import type { BibleTextVersionId } from "./bibleVersions";
import { languageForVersion } from "./readingScope";

export type WordSearchUiCopy = {
  placeholder: string;
  ariaLabel: string;
  ariaPanel: string;
  clear: string;
  close: string;
  ot: string;
  nt: string;
  dc: string;
  recents: string;
  suggestions: string;
  filterBook: string;
  applyPassages: (n: number) => string;
  showAll: (n: number) => string;
  passagesPartial: (shown: number, total: number) => string;
  passagesRange: (start: number, end: number, total: number) => string;
  passagesCount: (n: number) => string;
  pagination: string;
  page: (n: number) => string;
  empty: string;
  emptyInBook: (query: string, book: string) => string;
  outsideBook: (book: string) => string;
  emptyBooks: string;
  bookFallback: string;
  fuzzyBanner: string;
  orBanner: string;
  unavailable: string;
};

const FR: WordSearchUiCopy = {
  placeholder: "Mot ou expression…",
  ariaLabel: "Rechercher un mot ou une expression dans la Bible",
  ariaPanel: "Recherche dans la Bible",
  clear: "Effacer",
  close: "Fermer",
  ot: "Ancien",
  nt: "Nouveau",
  dc: "Deutéro.",
  recents: "RÉCENTS",
  suggestions: "SUGGESTIONS",
  filterBook: "Filtrer un livre…",
  applyPassages: (n) => `Appliquer (${n} passages)`,
  showAll: (n) => `Tout afficher (${n})`,
  passagesPartial: (shown, total) => `${shown} sur ${total} passages`,
  passagesRange: (start, end, total) => `${start}–${end} sur ${total} passages`,
  passagesCount: (n) => `${n} passage${n === 1 ? "" : "s"}`,
  pagination: "Pagination des résultats",
  page: (n) => `Page ${n}`,
  empty: "Aucun passage trouvé",
  emptyInBook: (query, book) =>
    `Aucun résultat pour « ${query} » dans ${book}.`,
  outsideBook: (book) =>
    `Aucun passage dans ${book}. Affichage hors de ce livre.`,
  emptyBooks: "Aucun livre trouvé",
  bookFallback: "Livre",
  fuzzyBanner:
    "Aucun résultat exact. Affichage des passages pour des termes proches.",
  orBanner:
    "Aucun verset avec tous les mots. Passages contenant une partie de votre recherche :",
  unavailable: "Recherche indisponible",
};

const HT: WordSearchUiCopy = {
  placeholder: "Chèche nan Bib la…",
  ariaLabel: "Chèche yon mo oswa yon ekspresyon nan Bib la",
  ariaPanel: "Rechèch nan Bib la",
  clear: "Efase",
  close: "Fèmen",
  ot: "Ansyen",
  nt: "Nouvo",
  dc: "Dewoterokanonik",
  recents: "RESAN",
  suggestions: "SIJESYON",
  filterBook: "Filtre yon liv…",
  applyPassages: (n) => `Aplike (${n} pasaj)`,
  showAll: (n) => `Montre tout (${n})`,
  passagesPartial: (shown, total) => `${shown} sou ${total} pasaj`,
  passagesRange: (start, end, total) => `${start}–${end} sou ${total} pasaj`,
  passagesCount: (n) => `${n} pasaj`,
  pagination: "Pajinasyon rezilta yo",
  page: (n) => `Paj ${n}`,
  empty: "Pa gen pasaj jwenn",
  emptyInBook: (query, book) =>
    `Pa gen rezilta pou « ${query} » nan ${book}.`,
  outsideBook: (book) =>
    `Pa gen pasaj nan ${book}. Nou montre rezilta deyò liv sa a.`,
  emptyBooks: "Pa gen liv jwenn",
  bookFallback: "Liv",
  fuzzyBanner:
    "Pa gen rezilta egzak. Nou montre pasaj pou mo ki sanble.",
  orBanner:
    "Pa gen vèsè ak tout mo yo. Pasaj ki gen yon pati nan rechèch ou a:",
  unavailable: "Rechèch pa disponib",
};

export function wordSearchUi(versionId: BibleTextVersionId): WordSearchUiCopy {
  return languageForVersion(versionId) === "ht" ? HT : FR;
}

export const WORD_SEARCH_SUGGESTIONS_FR = [
  "amour",
  "foi",
  "grâce",
  "Jean 3.16",
] as const;

export const WORD_SEARCH_SUGGESTIONS_HT = [
  "lanmou",
  "lafwa",
  "gras",
  "Jan 3.16",
] as const;

export function wordSearchSuggestions(
  versionId: BibleTextVersionId,
): readonly string[] {
  return languageForVersion(versionId) === "ht"
    ? WORD_SEARCH_SUGGESTIONS_HT
    : WORD_SEARCH_SUGGESTIONS_FR;
}
