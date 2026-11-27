/**
 * Motor de pesquisa por palavras (concordância com relevância).
 *
 * Recolha única com níveis, em vez de parar no 1.º nível com resultados:
 *   0 expressão exata (limites de palavra) · 1 todas as palavras na forma
 *   escrita · 2 outras formas da mesma palavra · 3 início de palavra /
 *   erro de escrita (só para termos sem forma conhecida).
 * Dentro do nível: livro do leitor primeiro, depois ordem canónica.
 * Sem versículo com todas as palavras → « partial_or » (alguma palavra).
 * Entre aspas → só a expressão exata.
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
  /** termo normalizado → alternativa(s) normalizada(s), aditivas (OR no grupo). */
  synonyms: Readonly<Record<string, string | readonly string[]>>;
  stemSuffixes: readonly string[];
  /**
   * Outras formas da mesma palavra presentes no vocabulário (plural,
   * feminino, conjugação). Sem isto: só a forma escrita.
   */
  inflect?: (token: string, has: (word: string) => boolean) => string[];
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
  /** Tamanho da página (1–100). Default 40. */
  limit?: number;
  /** Índice do primeiro hit da página (default 0). */
  offset?: number;
  profile: VerseSearchProfile;
  scope?: SearchScope;
  /** Livro do leitor — sobe no ranking antes do cânon (evita “começar” em Gênesis). */
  preferBookId?: string;
};

/** Mínimo de caracteres (normalizados) para disparar uma busca. */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/** Limite por pedido de página — não teto do universo de hits. */
export const SEARCH_PAGE_LIMIT_MAX = 100;

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
  const syn = Object.prototype.hasOwnProperty.call(profile.synonyms, t)
    ? profile.synonyms[t]
    : undefined;
  if (!syn) return [t];
  const out = [t];
  for (const alt of typeof syn === "string" ? [syn] : syn) {
    const mapped = normalizeSearchText(alt);
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
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









/** Amostra máxima para extrair termos fuzzy do universo escopado. */
const MATCHED_TERMS_HIT_CAP = 200;


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
 * Expressão exata com limites de palavra (« la vie » ≠ « la vierge »),
 * aceitando qualquer variante por sinónimo (ver phraseVariants).
 */
function phraseMatches(v: IndexedVerse, phrases: string[]): boolean {
  const padded = ` ${v.norm} `;
  return phrases.some((phrase) => phrase && padded.includes(` ${phrase} `));
}

/** Teto de variantes de frase (produto cartesiano dos sinónimos). */
const PHRASE_VARIANTS_MAX = 16;

/**
 * Frase normalizada + variantes trocando cada palavra pelos seus sinónimos
 * ("jezi" → ["jezi", "jezikri"]; "seye a se gado" → "senye a se gado").
 * Sem isto a expressão exata (e as aspas) ignorariam os sinónimos.
 */
export function phraseVariants(normQuery: string, profile: VerseSearchProfile): string[] {
  let variants = [""];
  for (const word of normQuery.split(" ").filter(Boolean)) {
    const alts = tokenAlternatives(word, profile);
    const next: string[] = [];
    for (const prefix of variants) {
      for (const alt of alts) {
        if (next.length >= PHRASE_VARIANTS_MAX) break;
        next.push(prefix ? `${prefix} ${alt}` : alt);
      }
    }
    variants = next;
  }
  return variants.filter(Boolean);
}

/** Aspas (" « “) à volta da consulta = só a expressão exata. */
export function isQuotedQuery(rawQuery: string): boolean {
  return /^\s*["«“].*\S.*["»”]\s*$/u.test(String(rawQuery || ""));
}

/** Níveis de correspondência por versículo (menor = mais relevante). */
const TIER_PHRASE = 0;
const TIER_EXACT = 1;
const TIER_INFLECTED = 2;
const TIER_APPROX = 3;

/** Palavras usadas por um termo da consulta, por tipo de correspondência. */
type TermWords = {
  exact: Set<string>;
  inflected: Set<string>;
  /** Início de palavra / erro de escrita → distância (0 = prefixo). */
  approx: Map<string, number>;
  fuzzy: boolean;
};

/** Máximo de palavras aproximadas por termo (prefixo / erro de escrita). */
const APPROX_WORDS_CAP = 400;

function termWords(
  alts: string[],
  index: VerseSearchIndex,
  profile: VerseSearchProfile,
  allowApprox: boolean,
): TermWords {
  const { tokenMap, uniqueTokens } = index;
  const has = (w: string) => Boolean(tokenMap[w]);
  const exact = new Set(alts.filter(has));
  const inflected = new Set<string>();
  for (const alt of alts) {
    for (const w of profile.inflect?.(alt, has) ?? []) {
      if (!exact.has(w)) inflected.add(w);
    }
  }
  const approx = new Map<string, number>();
  let fuzzy = false;
  if (allowApprox && exact.size === 0 && inflected.size === 0) {
    /* Início de palavra (pesquisa enquanto escreve: « resur » → résurrection). */
    const prefixAlts = alts.filter((t) => t.length >= 3);
    if (prefixAlts.length) {
      for (const tok of uniqueTokens) {
        if (prefixAlts.some((t) => tok.startsWith(t))) {
          approx.set(tok, 0);
          if (approx.size >= APPROX_WORDS_CAP) break;
        }
      }
    }
    /* Erro de escrita (« resurection »), ordenado pela distância. */
    if (approx.size === 0) {
      const fuzzyAlts = alts.filter((t) => t.length >= 5);
      for (const tok of uniqueTokens) {
        let best = Infinity;
        for (const t of fuzzyAlts) {
          if (!fuzzyTokenMatches(tok, t)) continue;
          best = Math.min(best, levenshtein(tok, t));
        }
        if (best !== Infinity) approx.set(tok, best);
      }
      /* Só o grupo mais próximo: « resurection » → résurrection (1), não
       * restriction (2). */
      const closest = Math.min(...approx.values());
      for (const [tok, d] of approx) if (d > closest) approx.delete(tok);
      fuzzy = approx.size > 0;
    }
  }
  return { exact, inflected, approx, fuzzy };
}

function termPostings(tokenMap: Record<string, number[]>, words: TermWords): number[] {
  return unionPostings(tokenMap, [
    ...words.exact,
    ...words.inflected,
    ...words.approx.keys(),
  ]);
}

/** Melhor correspondência de um termo num versículo (tier + distância). */
function termMatchIn(
  v: IndexedVerse,
  words: TermWords,
): { tier: number; distance: number } | null {
  let best: { tier: number; distance: number } | null = null;
  for (const w of v.words) {
    let m: { tier: number; distance: number } | null = null;
    if (words.exact.has(w)) m = { tier: TIER_EXACT, distance: 0 };
    else if (words.inflected.has(w)) m = { tier: TIER_INFLECTED, distance: 0 };
    else if (words.approx.has(w)) {
      m = { tier: TIER_APPROX, distance: words.approx.get(w)! };
    }
    if (!m) continue;
    if (!best || m.tier < best.tier || (m.tier === best.tier && m.distance < best.distance)) {
      best = m;
      if (best.tier === TIER_EXACT) break;
    }
  }
  return best;
}

type RankedHit = VerseSearchHit & { tier: number; distance: number };

/* ------------------------------------------------------------------------
 * Desempates dentro do mesmo nível/distância (calculados 1× por hit).
 * --------------------------------------------------------------------- */

/** Penalidade (em palavras) quando os termos só aparecem fora da ordem da consulta. */
const OUT_OF_ORDER_PENALTY = 3;

function wordMatchesTerm(word: string, terms: TermWords): boolean {
  return terms.exact.has(word) || terms.inflected.has(word) || terms.approx.has(word);
}

/** Menor janela com os termos na ORDEM da consulta; Infinity se não houver. */
function orderedSpan(occ: { pos: number; g: number }[], order: number[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < occ.length; i++) {
    if (occ[i]!.g !== order[0]) continue;
    let k = 1;
    let j = i + 1;
    for (; j < occ.length && k < order.length; j++) {
      if (occ[j]!.g === order[k]) k += 1;
    }
    if (k === order.length) best = Math.min(best, occ[j - 1]!.pos - occ[i]!.pos + 1);
  }
  return best;
}

/**
 * Proximidade: menor janela (em palavras) com todos os termos presentes no
 * versículo; fora da ordem da consulta soma OUT_OF_ORDER_PENALTY.
 * 0 = neutro (consulta de 1 termo).
 */
function minTermSpan(v: IndexedVerse, words: TermWords[]): number {
  if (words.length < 2) return 0;
  const tokens = v.norm.split(" ");
  const occ: { pos: number; g: number }[] = [];
  const present = new Set<number>();
  for (let pos = 0; pos < tokens.length; pos++) {
    for (let g = 0; g < words.length; g++) {
      if (wordMatchesTerm(tokens[pos]!, words[g]!)) {
        occ.push({ pos, g });
        present.add(g);
      }
    }
  }
  if (present.size < 2) return 0;
  const counts = new Map<number, number>();
  let covered = 0;
  let best = Number.MAX_SAFE_INTEGER;
  let lo = 0;
  for (let hi = 0; hi < occ.length; hi++) {
    const gh = occ[hi]!.g;
    const c = counts.get(gh) ?? 0;
    if (c === 0) covered += 1;
    counts.set(gh, c + 1);
    while (covered === present.size) {
      best = Math.min(best, occ[hi]!.pos - occ[lo]!.pos + 1);
      const gl = occ[lo]!.g;
      const cl = counts.get(gl)! - 1;
      counts.set(gl, cl);
      if (cl === 0) covered -= 1;
      lo += 1;
    }
  }
  const order = [...present].sort((a, b) => a - b);
  return Math.min(best + OUT_OF_ORDER_PENALTY, orderedSpan(occ, order));
}

/** Palavras com acentos da consulta, em minúsculas NFC ("pè", "seyè"). */
function accentedWords(text: string): string[] {
  return String(text || "")
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => w && /[^\u0000-\u007f]/.test(w));
}

const escapeRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Palavra inteira, sensível a acento (texto em NFC), insensível a maiúsculas. */
function accentWordPattern(word: string): RegExp {
  const W = String.raw`[\p{L}\p{M}\p{N}]`;
  return new RegExp(`(?<!${W})${escapeRegExp(word)}(?!${W})`, "iu");
}

/** Termos cuja palavra digitada (alts[0]) aparece inteira — vs. só o sinónimo. */
function countLiteralGroups(v: IndexedVerse, tokenGroups: string[][]): number {
  let n = 0;
  for (const alts of tokenGroups) if (alts[0] && v.words.includes(alts[0])) n += 1;
  return n;
}

/**
 * Chave de desempate (menor = melhor): proximidade › acento exato ›
 * palavra digitada antes do sinónimo › livro do leitor ›
 * cânon protestante antes de DC › ordem canónica.
 */
function tieBreakKey(
  v: IndexedVerse,
  ctx: {
    words: TermWords[];
    tokenGroups: string[][];
    accentPatterns: RegExp[];
    preferBookId?: string;
  },
): number[] {
  let accentHits = 0;
  for (const re of ctx.accentPatterns) if (re.test(v.raw)) accentHits += 1;
  const prefer =
    ctx.preferBookId && String(v.bookId || "").toUpperCase() === ctx.preferBookId ? 0 : 1;
  return [
    minTermSpan(v, ctx.words),
    -accentHits,
    -countLiteralGroups(v, ctx.tokenGroups),
    prefer,
    isDcBook(v.bookId) ? 1 : 0,
    v.canonIndex,
    v.chapter,
    v.verse,
  ];
}

/**
 * Pesquisa sobre o índice invertido.
 * Facetas = universo completo dos hits **antes** do filtro de escopo / limit.
 */
export function searchVersesCascadeOnIndex(
  index: VerseSearchIndex,
  rawQuery: string,
  options: SearchVersesCascadeOptions,
): VerseSearchResult {
  const profile = options.profile;
  const limit = Math.min(
    SEARCH_PAGE_LIMIT_MAX,
    Math.max(1, Number(options.limit) || 40),
  );
  const offset = Math.max(0, Math.floor(Number(options.offset) || 0));
  const { verses, tokenMap } = index;
  const { normQuery, tokenGroups } = prepareQueryTokens(rawQuery, profile);
  const quoted = isQuotedQuery(rawQuery);
  const phrases = phraseVariants(normQuery, profile);

  if (normQuery.length < SEARCH_MIN_QUERY_LENGTH || tokenGroups.length === 0) {
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
  /* Aspas: só formas exatas (sem flexão nem aproximação). */
  const words = tokenGroups.map((alts) =>
    quoted
      ? { exact: new Set(alts.filter((w) => tokenMap[w])), inflected: new Set<string>(), approx: new Map<string, number>(), fuzzy: false }
      : termWords(alts, index, profile, true),
  );
  const postings = words.map((w) => termPostings(tokenMap, w));

  let andIndices: number[] = postings[0] ?? [];
  for (let g = 1; g < postings.length && andIndices.length; g++) {
    andIndices = intersectSorted(andIndices, postings[g]!);
  }

  let mode: MatchMode = "exact_phrase";
  let matched: RankedHit[] = [];

  if (andIndices.length > 0 || slotCount === 1 || quoted) {
    for (const verse of versesFromIndices(verses, andIndices)) {
      const isPhrase = phraseMatches(verse, phrases);
      if (quoted && !isPhrase) continue;
      let tier = TIER_EXACT;
      let distance = 0;
      let ok = true;
      for (const w of words) {
        const m = termMatchIn(verse, w);
        if (!m) {
          ok = false;
          break;
        }
        tier = Math.max(tier, m.tier);
        distance += m.distance;
      }
      if (!ok) continue;
      if (isPhrase) tier = TIER_PHRASE;
      matched.push({ verse, matchCount: slotCount, tier, distance });
    }
    const bestTier = matched.reduce((min, h) => Math.min(min, h.tier), Infinity);
    mode = words.some((w) => w.fuzzy)
      ? "fuzzy"
      : bestTier <= TIER_PHRASE && slotCount > 1
        ? "exact_phrase"
        : bestTier <= TIER_EXACT
          ? slotCount > 1
            ? "all_terms"
            : "exact_phrase"
          : "stemmed";
  } else {
    /* Nenhum versículo com todas as palavras: os que têm alguma. */
    for (const verse of versesFromIndices(verses, unionIndices(postings))) {
      let matchCount = 0;
      let tier = TIER_EXACT;
      let distance = 0;
      for (const w of words) {
        const m = termMatchIn(verse, w);
        if (!m) continue;
        matchCount += 1;
        tier = Math.max(tier, m.tier);
        distance += m.distance;
      }
      if (matchCount > 0) matched.push({ verse, matchCount, tier, distance });
    }
    mode = "partial_or";
  }

  const preferBookId = String(options.preferBookId || "")
    .trim()
    .toUpperCase() || undefined;
  const tieCtx = {
    words,
    tokenGroups,
    accentPatterns: accentedWords(rawQuery).map(accentWordPattern),
    preferBookId,
  };
  const ranked = matched.map((hit) => ({ hit, key: tieBreakKey(hit.verse, tieCtx) }));
  ranked.sort((a, b) => {
    if (a.hit.matchCount !== b.hit.matchCount) return b.hit.matchCount - a.hit.matchCount;
    if (a.hit.tier !== b.hit.tier) return a.hit.tier - b.hit.tier;
    if (a.hit.distance !== b.hit.distance) return a.hit.distance - b.hit.distance;
    for (let i = 0; i < a.key.length; i++) {
      const d = a.key[i]! - b.key[i]!;
      if (d !== 0) return d;
    }
    return 0;
  });
  matched = ranked.map((r) => r.hit);

  const hits: VerseSearchHit[] = matched.map(({ verse, matchCount }) => ({
    verse,
    matchCount,
  }));
  // Facetas no universo completo (pré-filtro de escopo)
  const facets = buildSearchFacets(hits);
  const scoped = applySearchScope(hits, options.scope);
  const totalCount = scoped.length;
  const results = scoped.slice(offset, offset + limit);
  // Termos realmente encontrados (todas as formas) — destaque estável entre páginas.
  const matchedTerms = collectUsedWords(words, scoped);

  return {
    results,
    totalCount,
    matchMode: mode,
    matchedTerms,
    bookCounts: facets.byBook,
    facets,
  };
}

/** Máximo de termos devolvidos para destaque. */
const MATCHED_TERMS_CAP = 80;

/**
 * Formas que aparecem de facto nos resultados (para o destaque em todas as
 * páginas): exatas e flexões sempre; aproximadas (prefixo / erro) só as
 * vistas nos resultados, até ao limite.
 */
function collectUsedWords(words: TermWords[], hits: VerseSearchHit[]): string[] {
  const out = new Set<string>();
  for (const w of words) {
    for (const e of w.exact) out.add(e);
    for (const x of w.inflected) out.add(x);
  }
  const candidates = new Set<string>();
  for (const w of words) for (const x of w.approx.keys()) candidates.add(x);
  if (candidates.size) {
    const sample = hits.length > MATCHED_TERMS_HIT_CAP ? hits.slice(0, MATCHED_TERMS_HIT_CAP) : hits;
    for (const hit of sample) {
      for (const word of hit.verse.words) {
        if (candidates.has(word)) out.add(word);
        if (out.size >= MATCHED_TERMS_CAP) return [...out];
      }
    }
  }
  return [...out];
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
