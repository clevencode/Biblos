/**
 * Motor de busca em cascata (frase → AND → stem → fuzzy/OR).
 * Version-agnostic: regras linguísticas via VerseSearchProfile.
 */

import { CANON_BOOKS } from "../youversion/canon";
import {
  DC_BOOK_SET,
  NT_BOOK_SET,
  OT_BOOK_SET,
  isDcBook,
  isNtBook,
  isOtBook,
} from "./searchTestamentSets";

export type MatchMode =
  | "exact_phrase"
  | "all_terms"
  | "stemmed"
  | "fuzzy"
  | "partial_or";

export type VerseSearchProfile = {
  stopWords: ReadonlySet<string>;
  synonyms: Readonly<Record<string, string>>;
  stemSuffixes: readonly string[];
};

export type IndexedVerse = {
  usfm: string;
  bookId: string;
  bookTitle: string;
  chapter: number;
  verse: number;
  raw: string;
  norm: string;
  words: string[];
  canonIndex: number;
};

export type VerseSearchHit = {
  verse: IndexedVerse;
  matchCount: number;
};

export type SearchFacets = {
  total: number;
  otCount: number;
  ntCount: number;
  /** Hits em deuterocanônicos / livros fora do cânon protestante. */
  dcCount: number;
  byBook: Record<string, number>;
};

export type SearchScope =
  | { type: "all" }
  | { type: "ot" }
  | { type: "nt" }
  | { type: "dc" }
  | { type: "books"; bookIds: string[] };

export type VerseSearchResult = {
  results: VerseSearchHit[];
  totalCount: number;
  matchMode: MatchMode;
  matchedTerms: string[];
  /** Alias de facets.byBook (compat). */
  bookCounts: Record<string, number>;
  facets: SearchFacets;
};

export type SearchVersesCascadeOptions = {
  limit?: number;
  profile: VerseSearchProfile;
  scope?: SearchScope;
};

export function emptySearchFacets(): SearchFacets {
  return { total: 0, otCount: 0, ntCount: 0, dcCount: 0, byBook: {} };
}

/** Facets a partir de contagens por livro (API remota sem ot/nt/dc). */
export function facetsFromBookCounts(
  bookCounts: Record<string, number> | null | undefined,
  totalFallback = 0,
): SearchFacets {
  const byBook: Record<string, number> = {};
  let otCount = 0;
  let ntCount = 0;
  let dcCount = 0;
  let total = 0;
  for (const [rawId, rawCount] of Object.entries(bookCounts ?? {})) {
    const book = String(rawId || "").toUpperCase();
    const count = Math.max(0, Number(rawCount) || 0);
    if (!book || count <= 0) continue;
    byBook[book] = (byBook[book] || 0) + count;
    total += count;
    if (isOtBook(book)) otCount += count;
    else if (isNtBook(book)) ntCount += count;
    else dcCount += count;
  }
  return {
    total: total > 0 ? total : Math.max(0, totalFallback),
    otCount,
    ntCount,
    dcCount,
    byBook,
  };
}

export function buildSearchFacets(hits: VerseSearchHit[]): SearchFacets {
  const byBook: Record<string, number> = {};
  let otCount = 0;
  let ntCount = 0;
  let dcCount = 0;
  for (const hit of hits) {
    const book = String(hit.verse.bookId || "").toUpperCase();
    if (!book) continue;
    byBook[book] = (byBook[book] || 0) + 1;
    if (isOtBook(book)) otCount += 1;
    else if (isNtBook(book)) ntCount += 1;
    else dcCount += 1;
  }
  return {
    total: hits.length,
    otCount,
    ntCount,
    dcCount,
    byBook,
  };
}

/** IDs canônicos para filtrar a API remota a partir do SearchScope. */
export function bookIdsForSearchScope(scope: SearchScope | undefined): string[] | null {
  if (!scope || scope.type === "all") return null;
  if (scope.type === "ot") return [...OT_BOOK_SET];
  if (scope.type === "nt") return [...NT_BOOK_SET];
  if (scope.type === "dc") return [...DC_BOOK_SET];
  const ids = scope.bookIds
    .map((id) => String(id || "").toUpperCase())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

export function applySearchScope(
  hits: VerseSearchHit[],
  scope: SearchScope | undefined,
): VerseSearchHit[] {
  if (!scope || scope.type === "all") return hits;
  if (scope.type === "ot") {
    return hits.filter((h) => isOtBook(String(h.verse.bookId || "")));
  }
  if (scope.type === "nt") {
    return hits.filter((h) => isNtBook(String(h.verse.bookId || "")));
  }
  if (scope.type === "dc") {
    return hits.filter((h) => isDcBook(String(h.verse.bookId || "")));
  }
  const allowed = new Set(
    scope.bookIds.map((id) => String(id || "").toUpperCase()).filter(Boolean),
  );
  if (allowed.size === 0) return hits;
  return hits.filter((h) => allowed.has(String(h.verse.bookId || "").toUpperCase()));
}

/** Sufixos leves compartilhados (morfologia romance FR/HT). */
export const ROMANCE_STEM_SUFFIXES = [
  "ements",
  "ement",
  "ations",
  "ation",
  "aient",
  "ions",
  "iez",
  "ent",
  "ais",
  "ait",
  "es",
  "er",
  "ez",
  "s",
  "x",
] as const;

export function normalizeSearchText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`´]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave estável para comparar id/título de livro (ex.: "2 Rois" → "2rois"). */
export function normalizeBookKey(rawIdOrName: string): string {
  return String(rawIdOrName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const CANON_BY_ID = new Map(
  CANON_BOOKS.map((book) => [book.id.toUpperCase(), book.id.toUpperCase()]),
);
const CANON_BY_TITLE_KEY = new Map(
  CANON_BOOKS.map((book) => [
    normalizeBookKey(book.title),
    book.id.toUpperCase(),
  ]),
);

/** Resolve id canônico (USFM) a partir de bookId e/ou título legível. */
export function resolveCanonicalBookId(
  bookId?: string | null,
  bookTitle?: string | null,
): string {
  const rawId = String(bookId || "")
    .trim()
    .toUpperCase();
  if (rawId && CANON_BY_ID.has(rawId)) return rawId;
  const titleKey = normalizeBookKey(String(bookTitle || ""));
  if (titleKey) {
    const fromTitle = CANON_BY_TITLE_KEY.get(titleKey);
    if (fromTitle) return fromTitle;
  }
  if (rawId) return rawId;
  return "";
}

/** @deprecated Preferir normalizeSearchText */
export const normalizeFrenchText = normalizeSearchText;

export function tokenizeQuery(
  normText: string,
  profile: VerseSearchProfile,
  applyStopWords: boolean,
): string[] {
  const raw = String(normText || "")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!applyStopWords || raw.length < 2) return raw;
  const filtered = raw.filter((t) => !profile.stopWords.has(t));
  return filtered.length > 0 ? filtered : raw;
}

/** @deprecated Preferir tokenizeQuery */
export function tokenizeFrench(
  normText: string,
  applyStopWords: boolean,
  profile?: VerseSearchProfile,
): string[] {
  const stop = profile?.stopWords ?? new Set<string>();
  return tokenizeQuery(normText, { stopWords: stop, synonyms: {}, stemSuffixes: [] }, applyStopWords);
}

export function tokenAlternatives(
  token: string,
  profile: VerseSearchProfile,
): string[] {
  const t = String(token || "");
  if (!t) return [];
  const syn = profile.synonyms[t];
  if (!syn) return [t];
  const mapped = normalizeSearchText(syn);
  return mapped && mapped !== t ? [t, mapped] : [t];
}

export function expandSynonyms(
  tokens: string[],
  profile: VerseSearchProfile,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    for (const alt of tokenAlternatives(token, profile)) {
      if (seen.has(alt)) continue;
      seen.add(alt);
      out.push(alt);
    }
  }
  return out;
}

export function stemToken(token: string, profile: VerseSearchProfile): string {
  const t = String(token || "");
  if (t.length <= 4) return t;
  for (const suffix of profile.stemSuffixes) {
    if (t.length > suffix.length + 2 && t.endsWith(suffix)) {
      return t.slice(0, -suffix.length);
    }
  }
  return t;
}

/** @deprecated Preferir stemToken */
export function stemFrenchToken(
  token: string,
  suffixes: readonly string[] = ROMANCE_STEM_SUFFIXES,
): string {
  return stemToken(token, {
    stopWords: new Set(),
    synonyms: {},
    stemSuffixes: suffixes,
  });
}

export function levenshtein(a: string, b: string): number {
  const s = String(a || "");
  const t = String(b || "");
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array<number>(t.length + 1);
  const curr = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    const sc = s.charCodeAt(i - 1);
    for (let j = 1; j <= t.length; j++) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j]!;
  }
  return prev[t.length]!;
}

export function fuzzyMaxDistance(tokenLength: number): number {
  if (tokenLength < 5) return 0;
  if (tokenLength <= 7) return 1;
  return 2;
}

export function fuzzyTokenMatches(word: string, token: string): boolean {
  const max = fuzzyMaxDistance(token.length);
  if (max <= 0) return word === token;
  if (Math.abs(word.length - token.length) > max) return false;
  return levenshtein(word, token) <= max;
}

export function buildIndexedVerse(input: {
  usfm: string;
  bookId: string;
  bookTitle: string;
  chapter: number;
  verse: number;
  raw: string;
  canonIndex: number;
}): IndexedVerse {
  const raw = String(input.raw || "").trim();
  const norm = normalizeSearchText(raw);
  const words = [
    ...new Set(
      tokenizeQuery(
        norm,
        { stopWords: new Set(), synonyms: {}, stemSuffixes: [] },
        false,
      ),
    ),
  ];
  return {
    usfm: input.usfm,
    bookId: input.bookId,
    bookTitle: input.bookTitle,
    chapter: input.chapter,
    verse: input.verse,
    raw,
    norm,
    words,
    canonIndex: input.canonIndex,
  };
}

function shortTokenMatches(v: IndexedVerse, token: string): boolean {
  if (token.length >= 4) return v.norm.includes(token);
  return v.words.some((w) => w === token || w.startsWith(token));
}

function allTermsMatch(v: IndexedVerse, tokenGroups: string[][]): boolean {
  return tokenGroups.every((alts) => alts.some((t) => shortTokenMatches(v, t)));
}

function stemmedMatch(v: IndexedVerse, stemmedGroups: string[][]): boolean {
  return stemmedGroups.every((alts) =>
    alts.some((stem) => {
      if (stem.length >= 4) {
        return (
          v.words.some((w) => w === stem || w.startsWith(stem)) || v.norm.includes(stem)
        );
      }
      return v.words.some((w) => w === stem || w.startsWith(stem));
    }),
  );
}

function countWholeWordHits(v: IndexedVerse, tokens: string[]): number {
  let n = 0;
  for (const t of tokens) {
    if (v.words.includes(t)) n += 1;
  }
  return n;
}

function countPrefixHits(v: IndexedVerse, tokens: string[]): number {
  let n = 0;
  for (const t of tokens) {
    if (v.words.includes(t)) continue;
    if (v.words.some((w) => w.startsWith(t))) n += 1;
  }
  return n;
}

function countSubstringOrStemHits(
  v: IndexedVerse,
  tokens: string[],
  stemmed: string[],
  profile: VerseSearchProfile,
): number {
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const stem = stemmed[i] ?? stemToken(t, profile);
    if (v.words.includes(t)) continue;
    if (v.words.some((w) => w.startsWith(t))) continue;
    if (v.norm.includes(t) || v.norm.includes(stem) || v.words.some((w) => w.startsWith(stem))) {
      n += 1;
    }
  }
  return n;
}

function rankKey(
  v: IndexedVerse,
  normQuery: string,
  tokens: string[],
  stemmed: string[],
  matchCount: number,
  profile: VerseSearchProfile,
): [number, number, number, number, number, number, number, number] {
  const exactPhrase = normQuery && v.norm.includes(normQuery) ? 1 : 0;
  return [
    -exactPhrase,
    -matchCount,
    -countWholeWordHits(v, tokens),
    -countPrefixHits(v, tokens),
    -countSubstringOrStemHits(v, tokens, stemmed, profile),
    v.canonIndex,
    v.chapter,
    v.verse,
  ];
}

function compareRank(
  a: VerseSearchHit,
  b: VerseSearchHit,
  normQuery: string,
  tokens: string[],
  stemmed: string[],
  profile: VerseSearchProfile,
): number {
  const ka = rankKey(a.verse, normQuery, tokens, stemmed, a.matchCount, profile);
  const kb = rankKey(b.verse, normQuery, tokens, stemmed, b.matchCount, profile);
  for (let i = 0; i < ka.length; i++) {
    const d = ka[i]! - kb[i]!;
    if (d !== 0) return d;
  }
  return 0;
}

function collectMatchedTerms(
  mode: MatchMode,
  tokens: string[],
  stemmed: string[],
  hits: VerseSearchHit[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (t: string) => {
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const t of tokens) add(t);
  if (mode === "stemmed" || mode === "partial_or") {
    for (const s of stemmed) add(s);
  }
  if (mode === "fuzzy") {
    const token = tokens[0];
    if (token) {
      for (const hit of hits) {
        for (const w of hit.verse.words) {
          if (fuzzyTokenMatches(w, token)) add(w);
        }
      }
    }
  }
  return out;
}

export function prepareQueryTokens(
  rawQuery: string,
  profile: VerseSearchProfile,
): {
  normQuery: string;
  tokenGroups: string[][];
  tokens: string[];
  stemmedGroups: string[][];
  stemmed: string[];
} {
  const normQuery = normalizeSearchText(rawQuery);
  const baseTokens = tokenizeQuery(normQuery, profile, true);
  const tokenGroups = baseTokens.map((t) => tokenAlternatives(t, profile));
  const tokens = expandSynonyms(baseTokens, profile);
  const stemmedGroups = tokenGroups.map((alts) => [
    ...new Set(alts.map((a) => stemToken(a, profile))),
  ]);
  const stemmed = tokens.map((t) => stemToken(t, profile));
  return { normQuery, tokenGroups, tokens, stemmedGroups, stemmed };
}

/** Índice invertido por versão (RAM / IDB / worker). */
export type VerseSearchIndex = {
  verses: IndexedVerse[];
  /** token normalizado → índices em `verses` */
  tokenMap: Record<string, number[]>;
  uniqueTokens: string[];
};

export function buildTokenIndex(verses: IndexedVerse[]): VerseSearchIndex {
  const tokenMap: Record<string, number[]> = Object.create(null);
  for (let i = 0; i < verses.length; i++) {
    const verse = verses[i]!;
    for (const word of verse.words) {
      const list = tokenMap[word];
      if (list) list.push(i);
      else tokenMap[word] = [i];
    }
  }
  return {
    verses,
    tokenMap,
    uniqueTokens: Object.keys(tokenMap),
  };
}

function unionPostings(
  tokenMap: Record<string, number[]>,
  alts: string[],
): number[] {
  if (alts.length === 0) return [];
  if (alts.length === 1) return tokenMap[alts[0]!] ?? [];
  const seen = new Set<number>();
  for (const alt of alts) {
    const list = tokenMap[alt];
    if (!list) continue;
    for (const idx of list) seen.add(idx);
  }
  return [...seen].sort((a, b) => a - b);
}

function intersectSorted(a: number[], b: number[]): number[] {
  if (a.length === 0 || b.length === 0) return [];
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const av = a[i]!;
    const bv = b[j]!;
    if (av === bv) {
      out.push(av);
      i += 1;
      j += 1;
    } else if (av < bv) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return out;
}

/** Interseção das posting lists (união dentro de cada grupo de sinónimos). */
function intersectTokenGroups(
  tokenMap: Record<string, number[]>,
  tokenGroups: string[][],
): number[] {
  let result: number[] | null = null;
  for (const alts of tokenGroups) {
    const posting = unionPostings(tokenMap, alts);
    if (posting.length === 0) return [];
    result = result == null ? posting : intersectSorted(result, posting);
    if (result.length === 0) return [];
  }
  return result ?? [];
}

function versesFromIndices(
  verses: IndexedVerse[],
  indices: number[],
): IndexedVerse[] {
  const out: IndexedVerse[] = [];
  for (const idx of indices) {
    const v = verses[idx];
    if (v) out.push(v);
  }
  return out;
}

function unionIndices(lists: number[][]): number[] {
  const seen = new Set<number>();
  for (const list of lists) {
    for (const idx of list) seen.add(idx);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Cascata otimizada sobre índice invertido.
 * Facetas = universo completo dos hits **antes** do filtro de escopo / limit.
 */
export function searchVersesCascadeOnIndex(
  index: VerseSearchIndex,
  rawQuery: string,
  options: SearchVersesCascadeOptions,
): VerseSearchResult {
  const profile = options.profile;
  const limit = Math.min(80, Math.max(1, Number(options.limit) || 40));
  const { verses, tokenMap, uniqueTokens } = index;
  const { normQuery, tokenGroups, tokens, stemmedGroups, stemmed } =
    prepareQueryTokens(rawQuery, profile);

  if (normQuery.length < 2 || tokenGroups.length === 0) {
    const facets = emptySearchFacets();
    return {
      results: [],
      totalCount: 0,
      matchMode: "exact_phrase",
      matchedTerms: [],
      bookCounts: facets.byBook,
      facets,
    };
  }

  const slotCount = tokenGroups.length;
  let mode: MatchMode = "exact_phrase";
  let matched: VerseSearchHit[] = [];

  // Candidatos AND via tokenMap (evita full-scan nas etapas 1–2)
  const andCandidates = intersectTokenGroups(tokenMap, tokenGroups);
  const andVerses = versesFromIndices(verses, andCandidates);

  matched = andVerses
    .filter((v) => v.norm.includes(normQuery))
    .map((verse) => ({ verse, matchCount: slotCount }));
  if (matched.length > 0) {
    mode = "exact_phrase";
  } else {
    matched = andVerses
      .filter((v) => allTermsMatch(v, tokenGroups))
      .map((verse) => ({ verse, matchCount: slotCount }));
    if (matched.length > 0) {
      mode = "all_terms";
    } else {
      // Stem: matching só em uniqueTokens → postings
      const stemPostings: number[][] = [];
      for (const alts of stemmedGroups) {
        const matchedToks: string[] = [];
        for (const tok of uniqueTokens) {
          if (
            alts.some(
              (stem) =>
                tok === stem ||
                tok.startsWith(stem) ||
                (stem.length >= 4 && tok.includes(stem)),
            )
          ) {
            matchedToks.push(tok);
          }
        }
        stemPostings.push(unionPostings(tokenMap, matchedToks));
      }
      let stemIndices =
        stemPostings.length > 0 ? stemPostings[0]! : ([] as number[]);
      for (let g = 1; g < stemPostings.length; g++) {
        stemIndices = intersectSorted(stemIndices, stemPostings[g]!);
        if (stemIndices.length === 0) break;
      }
      const stemVerses = versesFromIndices(verses, stemIndices);
      matched = stemVerses
        .filter((v) => stemmedMatch(v, stemmedGroups))
        .map((verse) => ({ verse, matchCount: slotCount }));
      if (matched.length > 0) {
        mode = "stemmed";
      } else if (tokenGroups.length === 1) {
        const alts = tokenGroups[0]!;
        const fuzzyAlts = alts.filter((t) => t.length >= 5);
        if (fuzzyAlts.length > 0) {
          const fuzzyToks: string[] = [];
          for (const tok of uniqueTokens) {
            if (fuzzyAlts.some((t) => fuzzyTokenMatches(tok, t))) {
              fuzzyToks.push(tok);
            }
          }
          const fuzzyVerses = versesFromIndices(
            verses,
            unionPostings(tokenMap, fuzzyToks),
          );
          matched = fuzzyVerses
            .filter((v) =>
              v.words.some((w) => fuzzyAlts.some((t) => fuzzyTokenMatches(w, t))),
            )
            .map((verse) => ({ verse, matchCount: 1 }));
          mode = "fuzzy";
        }
      } else {
        // partial OR: união de postings por grupo stem
        const orLists: number[][] = [];
        for (const alts of stemmedGroups) {
          const matchedToks: string[] = [];
          for (const tok of uniqueTokens) {
            if (
              alts.some(
                (stem) =>
                  tok === stem ||
                  tok.startsWith(stem) ||
                  (stem.length >= 4 && tok.includes(stem)),
              )
            ) {
              matchedToks.push(tok);
            }
          }
          orLists.push(unionPostings(tokenMap, matchedToks));
        }
        const orVerses = versesFromIndices(verses, unionIndices(orLists));
        matched = [];
        for (const verse of orVerses) {
          let matchCount = 0;
          for (const alts of stemmedGroups) {
            const hit = alts.some(
              (stem) =>
                verse.words.some((w) => w === stem || w.startsWith(stem)) ||
                (stem.length >= 4 && verse.norm.includes(stem)),
            );
            if (hit) matchCount += 1;
          }
          if (matchCount > 0) matched.push({ verse, matchCount });
        }
        mode = "partial_or";
      }
    }
  }

  matched.sort((a, b) => compareRank(a, b, normQuery, tokens, stemmed, profile));
  // Facetas no universo completo (pré-filtro de escopo)
  const facets = buildSearchFacets(matched);
  const scoped = applySearchScope(matched, options.scope);
  const totalCount = scoped.length;
  const results = scoped.slice(0, limit);
  const matchedTerms = collectMatchedTerms(mode, tokens, stemmed, results);

  return {
    results,
    totalCount,
    matchMode: mode,
    matchedTerms,
    bookCounts: facets.byBook,
    facets,
  };
}

/** Compat: constrói tokenMap on-the-fly (testes / callers legados). */
export function searchVersesCascade(
  verses: IndexedVerse[],
  rawQuery: string,
  options: SearchVersesCascadeOptions,
): VerseSearchResult {
  return searchVersesCascadeOnIndex(buildTokenIndex(verses), rawQuery, options);
}

/** Alias tipado legado. */
export type S21SearchHit = VerseSearchHit;
export type S21SearchResult = VerseSearchResult;
export type SearchS21Options = { limit?: number; profile?: VerseSearchProfile };
