/**
 * Diksyonè Kreyòl Vilsen (3yèm edisyon) ligado ao texto HT98.
 *
 * Assets-first como o TSKe: `/bible/study/dict/*.json` (APK embutido / Workbox
 * CacheFirst na web), cache em memória, sem IndexedDB. Sem o asset, o loader
 * devolve `null` e o leitor simplesmente não ativa o dicionário.
 */

import { normalizeSearchText } from "./verseSearchEngine";

export const HT_DICT_BASE_URL = "/bible/study/dict";

export type HtDictEntry = {
  id: number;
  lemma: string;
  pos: string;
  gloss: string;
};

export type HtDictionaryJson = {
  version: number;
  title?: string;
  attribution?: string;
  count?: number;
  /** [id, lemma, pos, gloss] */
  entries: [number, string, string, string][];
};

export type HtAliasesJson = {
  version: number;
  aliases: Record<string, string>;
};

export type HtDictionary = {
  title: string;
  attribution: string;
  entries: HtDictEntry[];
  /** chave normalizada do lema → entradas (homógrafos) */
  byKey: Map<string, HtDictEntry[]>;
  /** palavra → lemas de várias palavras que a contêm ("a a tout boulin") */
  phrasesByWord: Map<string, HtDictEntry[]>;
  /** grafia HT98 → chave do lema no dicionário */
  aliases: Map<string, string>;
};

export type HtLookupVia = "exact" | "folded" | "alias" | "contraction" | "none";

export type HtWordLookup = {
  /** Palavra tal como foi tocada (NFC, minúsculas). */
  query: string;
  /** Chave efetivamente usada no dicionário (após alias / contração). */
  resolvedKey: string;
  via: HtLookupVia;
  /** Entradas do lema (homógrafos), acento exato primeiro. */
  entries: HtDictEntry[];
  /** Lemas de várias palavras que contêm o termo e aparecem no versículo. */
  expressions: HtDictEntry[];
};

/** Formas contraídas do crioulo (m'ap, l'a, y'al…) → pronome / partícula plena. */
export const HT_CONTRACTIONS: Readonly<Record<string, string>> = {
  m: "mwen",
  n: "nou",
  l: "li",
  y: "yo",
  w: "ou",
  k: "ki",
  t: "te",
  p: "pa",
};

/** Abreviações de categoria do Vilsen → rótulo em kreyòl. */
const POS_LABELS: Readonly<Record<string, string>> = {
  "a.": "adjektif",
  "adv.": "advèb",
  "det.": "detèminan",
  "ent.": "entèjeksyon",
  "entj.": "entèjeksyon",
  "entw.": "entewogatif",
  "eskl.": "esklamatif",
  "fr.": "fraz",
  "kon.": "konjonksyon",
  "konj.": "konjonksyon",
  "n.": "non",
  "n.fr.": "fraz non",
  "nf.": "fraz non",
  "np.": "non pwòp",
  "ono.": "onomatope",
  "pej.": "pejoratif",
  "pr.": "prepozisyon",
  "prep.": "prepozisyon",
  "pwo.": "pwonon",
  "sin.": "sinonim",
  "v.": "vèb",
  "vf.": "fraz vèb",
};

export function posLabel(pos: string): string {
  const key = String(pos || "").toLowerCase().replace(/\s+/g, "");
  return POS_LABELS[key] ?? POS_LABELS[`${key.replace(/\.$/, "")}.`] ?? "";
}

/** Chave de comparação: a mesma normalização da pesquisa bíblica. */
export function dictKey(text: string): string {
  return normalizeSearchText(text);
}

const nfcLower = (s: string) => String(s || "").normalize("NFC").toLowerCase().trim();

export function buildHtDictionary(
  json: HtDictionaryJson,
  aliasesJson?: HtAliasesJson | null,
): HtDictionary {
  const entries: HtDictEntry[] = [];
  const byKey = new Map<string, HtDictEntry[]>();
  const phrasesByWord = new Map<string, HtDictEntry[]>();
  for (const row of json.entries ?? []) {
    const [id, lemma, pos, gloss] = row;
    if (!lemma || !gloss) continue;
    const entry: HtDictEntry = { id: Number(id), lemma, pos: pos || "", gloss };
    entries.push(entry);
    const key = dictKey(lemma);
    if (!key) continue;
    const list = byKey.get(key);
    if (list) list.push(entry);
    else byKey.set(key, [entry]);
    const words = key.split(" ");
    if (words.length > 1) {
      for (const w of new Set(words)) {
        const phrases = phrasesByWord.get(w);
        if (phrases) phrases.push(entry);
        else phrasesByWord.set(w, [entry]);
      }
    }
  }
  const aliases = new Map<string, string>();
  for (const [from, to] of Object.entries(aliasesJson?.aliases ?? {})) {
    const k = dictKey(from);
    const v = dictKey(to);
    if (k && v && byKey.has(v)) aliases.set(k, v);
  }
  return {
    title: json.title ?? "Diksyonè Kreyòl Vilsen",
    attribution: json.attribution ?? "Diksyonè Kreyòl Vilsen — © Educa Vision Inc.",
    entries,
    byKey,
    phrasesByWord,
    aliases,
  };
}

function rankHomographs(list: HtDictEntry[], query: string): HtDictEntry[] {
  return [...list].sort((a, b) => {
    const ea = nfcLower(a.lemma) === query ? 0 : 1;
    const eb = nfcLower(b.lemma) === query ? 0 : 1;
    return ea - eb || a.id - b.id;
  });
}

/**
 * Procura a palavra tocada no dicionário, por esta ordem:
 * lema (acento exato primeiro) › alias HT98 › contração › nada.
 * As expressões (lemas de várias palavras) só contam se estiverem no versículo.
 */
export function lookupHtWord(
  dict: HtDictionary,
  token: string,
  verseText = "",
): HtWordLookup {
  const query = nfcLower(token);
  const key = dictKey(query);
  let resolvedKey = key;
  let via: HtLookupVia = "none";
  let entries: HtDictEntry[] = [];

  const direct = key ? dict.byKey.get(key) : undefined;
  if (direct?.length) {
    entries = rankHomographs(direct, query);
    via = entries.some((e) => nfcLower(e.lemma) === query) ? "exact" : "folded";
  } else if (key && dict.aliases.has(key)) {
    resolvedKey = dict.aliases.get(key)!;
    entries = dict.byKey.get(resolvedKey) ?? [];
    via = entries.length ? "alias" : "none";
  } else if (key && HT_CONTRACTIONS[key]) {
    resolvedKey = HT_CONTRACTIONS[key]!;
    entries = dict.byKey.get(resolvedKey) ?? [];
    via = entries.length ? "contraction" : "none";
  }

  const verseKey = ` ${dictKey(verseText)} `;
  const expressions = (dict.phrasesByWord.get(resolvedKey) ?? []).filter((e) =>
    verseKey.includes(` ${dictKey(e.lemma)} `),
  );

  return { query, resolvedKey, via, entries, expressions };
}

/**
 * Divide o gloss em sentidos numerados ("1. … 2. …"). Só aceita a sequência
 * 1, 2, 3… para não cortar em números do próprio texto ("A=10."). O OCR às
 * vezes lê "1." como "I." — tratado como 1.
 */
export function parseSenses(gloss: string): string[] {
  const text = String(gloss || "").trim();
  const re = /(^|\s)(\d{1,2}|I)\.\s+/g;
  const cuts: { at: number; body: number }[] = [];
  let expected = 1;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const n = m[2] === "I" ? 1 : Number(m[2]);
    // "Sentido 1" implícito: o gloss começa sem "1." e o primeiro número é "2.".
    if (expected === 1 && n === 2 && m.index > 0) expected = 2;
    if (n !== expected) continue;
    cuts.push({ at: m.index + m[1]!.length, body: m.index + m[0].length });
    expected += 1;
  }
  const implicitFirst = cuts.length > 0 && cuts[0]!.at > 0;
  if (cuts.length + (implicitFirst ? 1 : 0) < 2) {
    const single = cuts.length === 1 && cuts[0]!.at === 0 ? text.slice(cuts[0]!.body) : text;
    return [single.trim()].filter(Boolean);
  }
  const senses: string[] = [];
  if (cuts[0]!.at > 0) senses.push(text.slice(0, cuts[0]!.at).trim());
  for (let i = 0; i < cuts.length; i++) {
    const end = i + 1 < cuts.length ? cuts[i + 1]!.at : text.length;
    senses.push(text.slice(cuts[i]!.body, end).trim());
  }
  return senses.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Loader (browser / WebView)
// ---------------------------------------------------------------------------

let cached: HtDictionary | null = null;
let inflight: Promise<HtDictionary | null> | null = null;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    // SPA/HTML fallback quando o asset não existe.
    if (!raw || raw.startsWith("<")) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Dicionário em memória; `null` se o asset não existir (feature escondida). */
export function loadHtDictionary(): Promise<HtDictionary | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = (async () => {
      const [json, aliases] = await Promise.all([
        fetchJson<HtDictionaryJson>(`${HT_DICT_BASE_URL}/ht-vilsen.json`),
        fetchJson<HtAliasesJson>(`${HT_DICT_BASE_URL}/ht-aliases.json`),
      ]);
      if (!json?.entries?.length) return null;
      cached = buildHtDictionary(json, aliases);
      return cached;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Já carregado (síncrono) — para decidir o gesto sem esperar. */
export function getLoadedHtDictionary(): HtDictionary | null {
  return cached;
}
