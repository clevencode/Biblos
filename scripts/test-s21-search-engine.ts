/**
 * Motor de busca em cascata (S21 + perfil HT98).
 * Usage: npx tsx scripts/test-s21-search-engine.ts
 * Alias: npm run test:verse-search
 */
import assert from "node:assert/strict";
import {
  buildIndexedVerse,
  normalizeSearchText,
  searchVersesCascade,
  stemFrenchToken,
  type IndexedVerse,
} from "../src/bible/verseSearchEngine.ts";
import { HT98_PROFILE, S21_FR_PROFILE } from "../src/bible/verseSearchProfiles.ts";
import { searchS21Verses } from "../src/bible/s21SearchEngine.ts";

function verse(
  usfm: string,
  raw: string,
  canonIndex: number,
): IndexedVerse {
  const [bookId = "GEN", chapter = "1", v = "1"] = usfm.split(".");
  return buildIndexedVerse({
    usfm,
    bookId,
    bookTitle: bookId,
    chapter: Number(chapter),
    verse: Number(v),
    raw,
    canonIndex,
  });
}

const corpus: IndexedVerse[] = [
  verse("JHN.11.43", "Ayant dit cela, il cria d'une voix forte : Lazare, sors !", 43),
  verse(
    "JHN.11.25",
    "Jésus lui dit : Je suis la résurrection et la vie. Celui qui croit en moi vivra, même s'il meurt.",
    43,
  ),
  verse(
    "1CO.13.4",
    "L'amour est patient, l'amour est plein de bonté ; l'amour n'est pas envieux.",
    46,
  ),
  verse(
    "ACT.2.22",
    "Hommes israélites, écoutez ces paroles ! Jésus de Nazareth, cet homme que Dieu a reconnu auprès de vous par les miracles, les prodiges et les signes qu'il a faits par lui au milieu de vous.",
    44,
  ),
  verse(
    "JHN.11.5",
    "Or Jésus aimait Marthe, et sa sœur, et Lazare.",
    43,
  ),
  verse(
    "PSA.23.1",
    "Psaume de David. L'Eternel est mon berger : je ne manquerai de rien.",
    19,
  ),
];

const htCorpus: IndexedVerse[] = [
  verse(
    "JHN.11.43",
    "Apre li fin di sa, li rele byen fò: Laza, soti non!",
    43,
  ),
  verse(
    "JHN.3.16",
    "Paske Bondye sitèlman renmen lemonn, li bay sèl Pitit gason li a, pou tout moun ki gen konfyans nan li ka gen lavi ki p'ap janm fini.",
    43,
  ),
  verse(
    "PSA.23.1",
    "Seyè a se bèje mwen. Mwen p'ap manke anyen.",
    19,
  ),
];

// --- normalize / elision ---
assert.equal(normalizeSearchText("L'amour"), "l amour");
assert.ok(normalizeSearchText("résurrection").includes("resurrection"));

// --- Stage 1: exact phrase ---
{
  const r = searchS21Verses(corpus, "la résurrection et la vie");
  assert.equal(r.matchMode, "exact_phrase");
  assert.ok(r.results.some((h) => h.verse.usfm === "JHN.11.25"));
}

// --- Stage 2: all terms out of order (AND) ---
{
  const r = searchS21Verses(corpus, "jesus lazare");
  assert.equal(r.matchMode, "all_terms");
  assert.ok(r.results.some((h) => h.verse.usfm === "JHN.11.5"));
}

// --- Elision: l'amour → token amour ---
{
  const r = searchS21Verses(corpus, "amour");
  assert.ok(r.totalCount >= 1);
  assert.ok(r.results.some((h) => h.verse.usfm === "1CO.13.4"));
}

// --- Stage 3: stem plural/verb (aimer → aimait) ---
{
  assert.equal(stemFrenchToken("miracles"), "miracl");
  assert.equal(stemFrenchToken("aimer"), "aim");
  assert.equal(stemFrenchToken("aimait"), "aim");
  const r = searchS21Verses(corpus, "aimer");
  assert.equal(r.matchMode, "stemmed");
  assert.ok(r.results.some((h) => h.verse.usfm === "JHN.11.5"));
}

{
  const r = searchS21Verses(corpus, "miracle");
  assert.ok(r.totalCount >= 1, `expected miracle hits, got mode=${r.matchMode}`);
  assert.ok(r.results.some((h) => h.verse.usfm === "ACT.2.22"));
}

// --- Stage 4 fuzzy: typo ressurection ---
{
  const r = searchS21Verses(corpus, "ressurection");
  assert.equal(r.matchMode, "fuzzy");
  assert.ok(r.results.some((h) => h.verse.usfm === "JHN.11.25"));
  assert.ok(r.matchedTerms.some((t) => t.includes("resurrect") || t === "resurrection"));
}

// --- Stage 4 partial OR ---
{
  const r = searchS21Verses(corpus, "nabucodonosor lazare");
  assert.equal(r.matchMode, "partial_or");
  assert.ok(r.results.some((h) => h.verse.usfm === "JHN.11.43" || h.verse.usfm === "JHN.11.5"));
  assert.ok(r.results.every((h) => h.matchCount >= 1));
}

// --- Synonym Jehovah → Eternel ---
{
  const r = searchS21Verses(corpus, "jehovah");
  assert.ok(r.totalCount >= 1, `jehovah should map to eternel, mode=${r.matchMode}`);
  assert.ok(r.results.some((h) => h.verse.usfm === "PSA.23.1"));
}

// --- HT98 profile inherits cascade (out-of-order AND) ---
{
  const r = searchVersesCascade(htCorpus, "soti laza", {
    profile: HT98_PROFILE,
    limit: 10,
  });
  assert.equal(r.matchMode, "all_terms");
  assert.ok(r.results.some((h) => h.verse.usfm === "JHN.11.43"));
}

// --- HT98 stop words ignored when multi-token ---
{
  const r = searchVersesCascade(htCorpus, "nan bondye renmen", {
    profile: HT98_PROFILE,
    limit: 10,
  });
  assert.ok(
    r.matchMode === "all_terms" || r.matchMode === "exact_phrase" || r.matchMode === "stemmed",
    `unexpected mode ${r.matchMode}`,
  );
  assert.ok(r.results.some((h) => h.verse.usfm === "JHN.3.16"));
}

// --- Same engine API with explicit S21 profile ---
{
  const r = searchVersesCascade(corpus, "jesus lazare", {
    profile: S21_FR_PROFILE,
  });
  assert.equal(r.matchMode, "all_terms");
}

console.log("test-s21-search-engine: ok");
