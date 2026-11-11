/**
 * Motor de busca S21 em cascata (frase → AND → stem → fuzzy/OR).
 * Puro: sem React / IndexedDB.
 */

export type MatchMode =
  | "exact_phrase"
  | "all_terms"
  | "stemmed"
  | "fuzzy"
  | "partial_or";

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

export type S21SearchHit = {
  verse: IndexedVerse;
  matchCount: number;
};

export type S21SearchResult = {
  results: S21SearchHit[];
  totalCount: number;
  matchMode: MatchMode;
  matchedTerms: string[];
  bookCounts: Record<string, number>;
};

export type SearchS21Options = {
  limit?: number;
};

const FRENCH_STOP_WORDS = new Set([
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

/** Termos de outras traduções FR → equivalente S21. */
const S21_SYNONYMS: Record<string, string> = {
  jehovah: "eternel",
  yahve: "eternel",
  yahweh: "eternel",
  charite: "amour",
};

const STEM_SUFFIXES = [
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
];

export function normalizeFrenchText(text: string): string {
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

export function tokenizeFrench(normText: string, applyStopWords: boolean): string[] {
  const raw = String(normText || "")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!applyStopWords || raw.length < 2) return raw;
  const filtered = raw.filter((t) => !FRENCH_STOP_WORDS.has(t));
  return filtered.length > 0 ? filtered : raw;
}

/** Alternativas por token (termo original + equivalente S21, se houver). */
export function tokenAlternatives(token: string): string[] {
  const t = String(token || "");
  if (!t) return [];
  const syn = S21_SYNONYMS[t];
  if (!syn) return [t];
  const mapped = normalizeFrenchText(syn);
  return mapped && mapped !== t ? [t, mapped] : [t];
}

export function expandSynonyms(tokens: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    for (const alt of tokenAlternatives(token)) {
      if (seen.has(alt)) continue;
      seen.add(alt);
      out.push(alt);
    }
  }
  return out;
}

export function stemFrenchToken(token: string): string {
  const t = String(token || "");
  if (t.length <= 4) return t;
  for (const suffix of STEM_SUFFIXES) {
    if (t.length > suffix.length + 2 && t.endsWith(suffix)) {
      return t.slice(0, -suffix.length);
    }
  }
  return t;
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
  const norm = normalizeFrenchText(raw);
  const words = [...new Set(tokenizeFrench(norm, false))];
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
): number {
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const stem = stemmed[i] ?? stemFrenchToken(t);
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
): [number, number, number, number, number, number, number, number] {
  const exactPhrase = normQuery && v.norm.includes(normQuery) ? 1 : 0;
  return [
    -exactPhrase,
    -matchCount,
    -countWholeWordHits(v, tokens),
    -countPrefixHits(v, tokens),
    -countSubstringOrStemHits(v, tokens, stemmed),
    v.canonIndex,
    v.chapter,
    v.verse,
  ];
}

function compareRank(
  a: S21SearchHit,
  b: S21SearchHit,
  normQuery: string,
  tokens: string[],
  stemmed: string[],
): number {
  const ka = rankKey(a.verse, normQuery, tokens, stemmed, a.matchCount);
  const kb = rankKey(b.verse, normQuery, tokens, stemmed, b.matchCount);
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
  hits: S21SearchHit[],
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

export function prepareQueryTokens(rawQuery: string): {
  normQuery: string;
  /** Uma alternativa por slot de query (sinônimos = OR dentro do slot). */
  tokenGroups: string[][];
  /** Flatten para ranking / highlight. */
  tokens: string[];
  stemmedGroups: string[][];
  stemmed: string[];
} {
  const normQuery = normalizeFrenchText(rawQuery);
  const baseTokens = tokenizeFrench(normQuery, true);
  const tokenGroups = baseTokens.map(tokenAlternatives);
  const tokens = expandSynonyms(baseTokens);
  const stemmedGroups = tokenGroups.map((alts) =>
    [...new Set(alts.map(stemFrenchToken))],
  );
  const stemmed = tokens.map(stemFrenchToken);
  return { normQuery, tokenGroups, tokens, stemmedGroups, stemmed };
}

export function searchS21Verses(
  verses: IndexedVerse[],
  rawQuery: string,
  options?: SearchS21Options,
): S21SearchResult {
  const limit = Math.min(80, Math.max(1, Number(options?.limit) || 40));
  const { normQuery, tokenGroups, tokens, stemmedGroups, stemmed } =
    prepareQueryTokens(rawQuery);

  if (normQuery.length < 2 || tokenGroups.length === 0) {
    return {
      results: [],
      totalCount: 0,
      matchMode: "exact_phrase",
      matchedTerms: [],
      bookCounts: {},
    };
  }

  const slotCount = tokenGroups.length;
  let mode: MatchMode = "exact_phrase";
  let matched: S21SearchHit[] = [];

  // Stage 1 — exact phrase
  matched = verses
    .filter((v) => v.norm.includes(normQuery))
    .map((verse) => ({ verse, matchCount: slotCount }));
  if (matched.length > 0) {
    mode = "exact_phrase";
  } else {
    // Stage 2 — all terms (flexible AND; sinônimos = OR por slot)
    matched = verses
      .filter((v) => allTermsMatch(v, tokenGroups))
      .map((verse) => ({ verse, matchCount: slotCount }));
    if (matched.length > 0) {
      mode = "all_terms";
    } else {
      // Stage 3 — light French stemming
      matched = verses
        .filter((v) => stemmedMatch(v, stemmedGroups))
        .map((verse) => ({ verse, matchCount: slotCount }));
      if (matched.length > 0) {
        mode = "stemmed";
      } else if (tokenGroups.length === 1) {
        // Stage 4a — fuzzy (single token ≥ 5)
        const alts = tokenGroups[0]!;
        const fuzzyAlts = alts.filter((t) => t.length >= 5);
        if (fuzzyAlts.length > 0) {
          matched = verses
            .filter((v) =>
              v.words.some((w) => fuzzyAlts.some((t) => fuzzyTokenMatches(w, t))),
            )
            .map((verse) => ({ verse, matchCount: 1 }));
          mode = "fuzzy";
        }
      } else {
        // Stage 4b — partial OR on stems (por slot)
        matched = [];
        for (const verse of verses) {
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

  matched.sort((a, b) => compareRank(a, b, normQuery, tokens, stemmed));
  const totalCount = matched.length;
  const bookCounts: Record<string, number> = {};
  for (const hit of matched) {
    const book = hit.verse.bookId;
    if (!book) continue;
    bookCounts[book] = (bookCounts[book] || 0) + 1;
  }
  const results = matched.slice(0, limit);
  const matchedTerms = collectMatchedTerms(mode, tokens, stemmed, results);

  return { results, totalCount, matchMode: mode, matchedTerms, bookCounts };
}
