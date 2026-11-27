/**
 * Busca HT98 sobre o corpus real (`public/bibles/ht1998.json`).
 * Usage: npx tsx scripts/test-ht98-search.ts
 * Alias: npm run test:ht98-search
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildIndexedVerse,
  buildTokenIndex,
  normalizeSearchText,
  searchVersesCascadeOnIndex,
  type IndexedVerse,
  type SearchScope,
} from "../src/bible/verseSearchEngine.ts";
import { HT98_PROFILE } from "../src/bible/verseSearchProfiles.ts";
import {
  makeSearchSnippet,
  normalizeWithOffsets,
} from "../src/bible/searchSnippet.ts";

type Root = {
  books: {
    usfm: string;
    title: string;
    chapters: { chapter: number; verses: { number: number; text: string }[] }[];
  }[];
};

const jsonPath = fileURLToPath(new URL("../public/bibles/ht1998.json", import.meta.url));
const root = JSON.parse(readFileSync(jsonPath, "utf8")) as Root;

const verses: IndexedVerse[] = [];
root.books.forEach((book, canonIndex) => {
  const bookId = book.usfm.toUpperCase();
  for (const ch of book.chapters) {
    for (const v of ch.verses) {
      const raw = String(v.text || "").replace(/\s+/g, " ").trim();
      if (!raw) continue;
      verses.push(
        buildIndexedVerse({
          usfm: `${bookId}.${ch.chapter}.${v.number}`,
          bookId,
          bookTitle: book.title,
          chapter: ch.chapter,
          verse: v.number,
          raw,
          canonIndex,
        }),
      );
    }
  }
});
const index = buildTokenIndex(verses);

function search(q: string, scope: SearchScope = { type: "all" }, limit = 40) {
  return searchVersesCascadeOnIndex(index, q, { profile: HT98_PROFILE, scope, limit });
}

const has = (r: ReturnType<typeof search>, usfm: string) =>
  r.results.some((h) => h.verse.usfm === usfm);

// --- Corpus sanity ---
assert.ok(verses.length > 35000, `corpus HT98 incompleto: ${verses.length}`);

// --- Snippet: normalização com offsets ≡ normalizeSearchText (corpus inteiro) ---
for (const v of verses) {
  const { norm, offsets } = normalizeWithOffsets(v.raw);
  assert.equal(norm, v.norm, `normalizeWithOffsets diverge em ${v.usfm}`);
  assert.equal(offsets.length, norm.length);
}

// --- Frase exata: Jan 3.16 ---
{
  const r = search("Bondye sitèlman renmen lèzòm");
  assert.equal(r.matchMode, "exact_phrase");
  assert.ok(has(r, "JHN.3.16"), "JHN.3.16 deve aparecer");
  assert.equal(r.results[0]!.verse.usfm, "JHN.3.16");
}

// --- Frase em palavras inteiras (não substring) ---
{
  // Aspas = só a expressão exata (contrato do motor por níveis).
  const r = search('"renmen lezom"');
  assert.ok(r.totalCount > 0);
  assert.ok(r.results.every((h) => ` ${h.verse.norm} `.includes(" renmen lezom ")));
}

// --- Termos fora de ordem (AND) ---
{
  const r = search("lèzòm Bondye renmen sitèlman");
  assert.equal(r.matchMode, "all_terms");
  assert.ok(has(r, "JHN.3.16"));
}

// --- Contrações: "p'ap" = "p ap" e não explode em prefixos de "p" ---
{
  const r = search("p'ap janm fini");
  assert.equal(r.matchMode, "exact_phrase");
  assert.ok(has(r, "JHN.3.16"));
}

// --- Sinónimos / grafia: Seyè → Senyè; Jésus → Jezi + Jezikri ---
{
  const seye = search("Seyè se gadò mwen");
  assert.ok(seye.totalCount > 0, "Seyè deve achar Senyè");
  assert.ok(has(seye, "PSA.23.1"), "Sòm 23.1 via Seyè");

  const jesus = search("Jésus");
  const jezi = search("Jezi");
  assert.ok(jesus.totalCount >= jezi.totalCount);
  const onlyJezi = index.tokenMap.jezi?.length ?? 0;
  const jeziOrJezikri = new Set([
    ...(index.tokenMap.jezi ?? []),
    ...(index.tokenMap.jezikri ?? []),
  ]).size;
  assert.ok(jeziOrJezikri > onlyJezi);
  assert.equal(
    jezi.facets.total,
    jeziOrJezikri,
    `Jezi deve incluir Jezikri (total=${jezi.facets.total})`,
  );
  assert.ok(jezi.matchedTerms.includes("jezikri"));
}

// --- Ranking: proximidade dos termos (Sòm 23.1 antes de Jen 4.9) ---
{
  const r = search("Seyè se gadò mwen");
  assert.equal(r.results[0]!.verse.usfm, "PSA.23.1", `top=${r.results[0]!.verse.usfm}`);
}

// --- Ranking: palavra digitada antes do sinónimo; sinónimo não infla score;
//     cânon protestante antes de DC em empate ---
{
  const r = search("Jezi");
  assert.ok(r.results.every((h) => h.verse.words.includes("jezi")));
  assert.notEqual(r.results[0]!.verse.bookId, "SIR");
  assert.ok(["MAT", "MRK", "LUK", "JHN"].includes(r.results[0]!.verse.bookId) || r.results[0]!.verse.canonIndex < 50);
}

// --- Stopwords HT: "nan" removido em consulta multi-termo ---
{
  const a = search("Bondye nan syèl la");
  assert.ok(a.totalCount > 0);
}

// --- Sem stemming romance; prefixo curto (< 3) não explode; início de palavra ---
{
  const pe = search("pe");
  assert.ok(pe.results.every((h) => h.verse.words.includes("pe")), "'pe' só palavra inteira");
  const r = search("renm");
  assert.equal(r.matchMode, "stemmed");
  assert.ok(r.matchedTerms.includes("renmen"));
  assert.ok(r.results.every((h) => h.verse.words.some((w) => w.startsWith("renm"))));
}

// --- Fuzzy multi-termo: erro de digitação não cai em OR gigante ---
{
  const r = search("Bondye remen lezòm");
  assert.equal(r.matchMode, "fuzzy", `mode=${r.matchMode}`);
  assert.ok(has(r, "JHN.3.16"));
  assert.ok(r.totalCount < 50, `fuzzy AND deve ser restrito (total=${r.totalCount})`);
}

// --- Acento exato sobe no ranking: "pè" (pai/padre) antes de "pe" (calar) ---
{
  const r = search("pè", { type: "all" }, 100);
  assert.ok(r.results.length > 0);
  const firstPe = r.results.findIndex((h) => /(^|[^\p{L}])pe([^\p{L}]|$)/iu.test(h.verse.raw));
  const lastPeAccent = r.results.findLastIndex((h) => /(^|[^\p{L}])pè([^\p{L}]|$)/iu.test(h.verse.raw));
  if (firstPe >= 0 && lastPeAccent >= 0) {
    assert.ok(lastPeAccent < firstPe || r.results.length === 100, "pè antes de pe");
  }
  assert.ok(/(^|[^\p{L}])pè([^\p{L}]|$)/iu.test(r.results[0]!.verse.raw));
}

// --- Escopo DC (deuterocanônicos) + facetas pré-escopo ---
{
  const all = search("Tobi");
  const dc = search("Tobi", { type: "dc" });
  assert.ok(dc.totalCount > 0);
  assert.ok(dc.results.every((h) => ["TOB", "JDT", "ESG", "WIS", "SIR", "LJE", "BAR", "DAG", "SUS", "BEL", "1MA", "2MA"].includes(h.verse.bookId)));
  assert.equal(dc.facets.total, all.facets.total);
}

// --- Consulta curta: ok vazio (contrato único) ---
{
  const r = search("a");
  assert.equal(r.totalCount, 0);
}

// --- Snippet alinhado ao texto original (acentos + pontuação) ---
{
  const v = verses.find((x) => x.usfm === "JHN.3.16")!;
  const s = makeSearchSnippet(v.raw, normalizeSearchText("lavi ki p'ap janm fini"), 20);
  assert.ok(s.includes("lavi ki p'ap janm fini"), `snippet desalinhado: ${s}`);
  const rawWords = new Set(v.raw.split(" "));
  const snippetWords = s.replace(/^…|…$/g, "").split(" ");
  assert.ok(rawWords.has(snippetWords[0]!), `corta a 1ª palavra: ${s}`);
  assert.ok(rawWords.has(snippetWords.at(-1)!), `corta a última palavra: ${s}`);
}

console.log(`test-ht98-search: ok (${verses.length} versets)`);
