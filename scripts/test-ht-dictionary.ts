/**
 * Diksyonè Vilsen ↔ HT98: palavra sob o dedo, lookup e cobertura no corpus real.
 * Usage: npx tsx scripts/test-ht-dictionary.ts
 * Alias: npm run test:ht-dictionary
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildHtDictionary,
  lookupHtWord,
  parseSenses,
  posLabel,
  type HtAliasesJson,
  type HtDictionaryJson,
} from "../src/bible/htDictionary.ts";
import { extractWordAt } from "../src/bible/wordAtPoint.ts";

const read = <T>(rel: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;

const dictJson = read<HtDictionaryJson>("../data/bible/study/dict/ht-vilsen.json");
const aliasesJson = read<HtAliasesJson>("../data/bible/study/dict/ht-aliases.json");
const dict = buildHtDictionary(dictJson, aliasesJson);

// --- Dados ---
assert.equal(dict.entries.length, 10773);
assert.ok(dict.attribution.includes("Educa Vision"), "atribuição obrigatória");
assert.equal(
  dict.aliases.size,
  Object.keys(aliasesJson.aliases).length,
  "todo alias tem de apontar para um lema existente",
);

// --- extractWordAt: acentos, pontuação, contrações ---
{
  const t = "Senyè a se gadò mwen, mwen p'ap janm manke anyen.";
  assert.deepEqual(extractWordAt(t, 2), { word: "Senyè", start: 0, end: 5 });
  assert.equal(extractWordAt(t, 5)?.word, "Senyè", "cursor logo após a palavra");
  assert.equal(extractWordAt(t, t.indexOf("gadò") + 3)?.word, "gadò");
  const ap = t.indexOf("p'ap");
  assert.equal(extractWordAt(t, ap)?.word, "p", "lado esquerdo da contração");
  assert.equal(extractWordAt(t, ap + 3)?.word, "ap", "lado direito da contração");
  assert.equal(extractWordAt("a , b", 2), null, "pontuação isolada");
  assert.equal(extractWordAt("", 0), null);
  assert.equal(extractWordAt("p’ap", 3)?.word, "ap", "apóstrofo tipográfico");
}

// --- Lookup ---
{
  const r = lookupHtWord(dict, "renmen");
  assert.equal(r.via, "exact");
  assert.equal(r.entries[0]!.lemma, "renmen");
  assert.equal(r.entries[0]!.pos, "v.");
}
{
  const r = lookupHtWord(dict, "Bondye");
  assert.equal(r.via, "exact", "maiúscula não impede");
  assert.ok(r.entries[0]!.gloss.length > 10);
}
{
  // Sem acento na consulta → encontra o lema acentuado ("folded").
  const r = lookupHtWord(dict, "konfyans");
  assert.ok(r.entries.length > 0);
  const g = lookupHtWord(dict, "gado");
  assert.equal(g.via, "folded");
  assert.equal(g.entries[0]!.lemma, "gadò");
}
{
  // Homógrafos: acento exato primeiro.
  const homographKey = [...dict.byKey].find(
    ([, list]) => new Set(list.map((e) => e.lemma.normalize("NFC").toLowerCase())).size > 1,
  );
  assert.ok(homographKey, "corpus tem homógrafos por acento");
  const [, list] = homographKey!;
  const target = list[list.length - 1]!.lemma;
  const r = lookupHtWord(dict, target);
  assert.equal(r.entries[0]!.lemma.normalize("NFC").toLowerCase(), target.normalize("NFC").toLowerCase());
}
{
  // Contração: m' → mwen
  const r = lookupHtWord(dict, "m");
  assert.equal(r.via, "contraction");
  assert.equal(r.resolvedKey, "mwen");
  assert.ok(r.entries.length > 0);
}
{
  // Alias HT98 → lema do dicionário
  const r = lookupHtWord(dict, "lènmi");
  assert.equal(r.via, "alias");
  assert.equal(r.entries[0]!.lemma, "lennmi");
}
{
  // Expressão de várias palavras presente no versículo
  const phrase = dict.entries.find((e) => e.lemma === "kounye a");
  assert.ok(phrase, "lema 'kounye a' existe");
  const r = lookupHtWord(dict, "kounye", "Kounye a, nou konnen sa.");
  assert.ok(r.expressions.some((e) => e.lemma === "kounye a"));
  const none = lookupHtWord(dict, "kounye", "Kounye nou ale.");
  assert.ok(!none.expressions.some((e) => e.lemma === "kounye a"), "só se a expressão estiver inteira");
}
{
  const r = lookupHtWord(dict, "zzzqqq");
  assert.equal(r.via, "none");
  assert.deepEqual(r.entries, []);
}

// --- Sentidos numerados e categoria ---
{
  const senses = parseSenses("1. Premye sans. 2. Dezyèm sans ak A=10. nan tèks la. 3. Twazyèm.");
  assert.equal(senses.length, 3);
  assert.equal(senses[0], "Premye sans.");
  assert.ok(senses[1]!.includes("A=10."), "não corta em números do texto");
  assert.deepEqual(parseSenses("I. Metal ki di. 2. Zouti."), ["Metal ki di.", "Zouti."]);
  assert.deepEqual(parseSenses("Yon sèl sans."), ["Yon sèl sans."]);
  // Gloss real de "bondye": sentido 1 sem número, depois "2."
  assert.deepEqual(parseSenses("Espri ki reprezante fos siprèm. 2. Kas pou fè cheve."), [
    "Espri ki reprezante fos siprèm.",
    "Kas pou fè cheve.",
  ]);
  assert.equal(posLabel("v."), "vèb");
  assert.equal(posLabel("n.fr."), "fraz non");
}

// --- Cobertura no HT98 real (não pode regredir abaixo da linha de base medida) ---
{
  type Root = { books: { chapters: { verses: { text: string }[] }[] }[] };
  const bible = read<Root>("../public/bibles/ht1998.json");
  let total = 0;
  let covered = 0;
  for (const b of bible.books)
    for (const c of b.chapters)
      for (const v of c.verses)
        for (const w of v.text.normalize("NFC").split(/[^\p{L}\p{M}]+/u)) {
          if (!w) continue;
          total += 1;
          if (lookupHtWord(dict, w).entries.length > 0) covered += 1;
        }
  const pct = (100 * covered) / total;
  console.log(`cobertura HT98: ${pct.toFixed(1)}% das ocorrências (${covered}/${total})`);
  // Linha de base: 71,4% só com lemas; 74,6% com contrações + aliases.
  assert.ok(pct >= 74.5, `cobertura caiu: ${pct.toFixed(1)}%`);
}

console.log("test-ht-dictionary: ok");
