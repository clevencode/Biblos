/**
 * Motor de busca em cascata (S21 + perfil HT98).
 * Usage: npx tsx scripts/test-s21-search-engine.ts
 * Alias: npm run test:verse-search
 */
import assert from "node:assert/strict";
import {
  bookIdsForSearchScope,
  buildIndexedVerse,
  buildTokenIndex,
  facetsFromBookCounts,
  normalizeSearchText,
  searchVersesCascade,
  searchVersesCascadeOnIndex,
  stemFrenchToken,
  type IndexedVerse,
  type SearchS21Options,
  type S21SearchResult,
} from "../src/bible/verseSearchEngine.ts";
import { HT98_PROFILE, S21_FR_PROFILE } from "../src/bible/verseSearchProfiles.ts";

function searchS21Verses(
  verses: IndexedVerse[],
  rawQuery: string,
  options?: SearchS21Options,
): S21SearchResult {
  return searchVersesCascade(verses, rawQuery, {
    limit: options?.limit,
    profile: options?.profile ?? S21_FR_PROFILE,
  });
}

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

// --- Facets + scope books (pré-filtro vs pós-filtro) ---
{
  const all = searchVersesCascade(corpus, "jesus", {
    profile: S21_FR_PROFILE,
    limit: 40,
  });
  assert.ok(all.facets.total >= 2, `expected multi-book jesus hits, got ${all.facets.total}`);
  assert.ok((all.facets.byBook.JHN ?? 0) >= 1);
  assert.equal(all.bookCounts.JHN, all.facets.byBook.JHN);
  assert.ok(all.facets.ntCount >= all.facets.byBook.JHN);

  const scoped = searchVersesCascade(corpus, "jesus", {
    profile: S21_FR_PROFILE,
    limit: 40,
    scope: { type: "books", bookIds: ["JHN"] },
  });
  assert.ok(
    scoped.totalCount < all.facets.total,
    `scoped total ${scoped.totalCount} should be < facets.total ${all.facets.total}`,
  );
  assert.ok(scoped.results.every((h) => h.verse.bookId.toUpperCase() === "JHN"));
  assert.equal(
    scoped.facets.total,
    all.facets.total,
    "facets must stay on the unscoped universe",
  );
  assert.equal(scoped.facets.byBook.JHN, all.facets.byBook.JHN);
  assert.equal(scoped.totalCount, scoped.results.length);
}

// --- facetsFromBookCounts: ot/nt a partir de byBook (sem zerar) ---
{
  const facets = facetsFromBookCounts(
    { JHN: 10, PSA: 5, GEN: 3, ROM: 2 },
    0,
  );
  assert.equal(facets.total, 20);
  assert.equal(facets.ntCount, 12);
  assert.equal(facets.otCount, 8);
  assert.equal(facets.dcCount, 0);
  assert.equal(facets.byBook.JHN, 10);
  assert.ok((bookIdsForSearchScope({ type: "nt" }) ?? []).includes("JHN"));
  assert.ok((bookIdsForSearchScope({ type: "ot" }) ?? []).includes("JDG"));
  assert.equal(bookIdsForSearchScope({ type: "all" }), null);
  assert.deepEqual(
    bookIdsForSearchScope({ type: "books", bookIds: ["jdg", "JHN"] }),
    ["JDG", "JHN"],
  );
}

// --- facets + scope dc (deuterocanônicos HT) ---
{
  const facets = facetsFromBookCounts(
    { JHN: 4, TOB: 7, SIR: 3, GEN: 2 },
    0,
  );
  assert.equal(facets.total, 16);
  assert.equal(facets.ntCount, 4);
  assert.equal(facets.otCount, 2);
  assert.equal(facets.dcCount, 10);
  const dcIds = bookIdsForSearchScope({ type: "dc" }) ?? [];
  assert.ok(dcIds.includes("TOB"));
  assert.ok(dcIds.includes("SIR"));
  const dcCorpus: IndexedVerse[] = [
    ...htCorpus,
    verse("TOB.1.1", "Istwa Tobi, pitit Tobit, nan tribilye Neftali.", 100),
  ];
  const scoped = searchVersesCascade(dcCorpus, "Tobi", {
    profile: HT98_PROFILE,
    limit: 10,
    scope: { type: "dc" },
  });
  assert.ok(scoped.results.every((h) => h.verse.bookId.toUpperCase() === "TOB"));
}

// --- tokenMap: mesma qualidade que full-scan; facetas pré-scope ---
{
  const index = buildTokenIndex(corpus);
  assert.ok(index.uniqueTokens.length > 0);
  assert.ok((index.tokenMap.jesus ?? index.tokenMap.amour)?.length);
  const viaIndex = searchVersesCascadeOnIndex(index, "jesus lazare", {
    profile: S21_FR_PROFILE,
    limit: 40,
    scope: { type: "nt" },
  });
  const viaArray = searchVersesCascade(corpus, "jesus lazare", {
    profile: S21_FR_PROFILE,
    limit: 40,
    scope: { type: "nt" },
  });
  assert.equal(viaIndex.matchMode, viaArray.matchMode);
  assert.equal(viaIndex.facets.total, viaArray.facets.total);
  assert.ok(viaIndex.facets.ntCount >= 1);
  assert.ok(
    viaIndex.results.every((h) => h.verse.bookId.toUpperCase() !== "PSA"),
  );
}

// --- Relevância por níveis + formas da palavra (concordância) ---
{
  const c: IndexedVerse[] = [
    verse("GEN.16.7", "L'ange de l'Eternel la trouva près d'une source.", 1),
    verse("GEN.19.1", "Les deux anges arrivèrent à Sodome le soir.", 1),
    verse("PSA.23.1", "L'Eternel est mon berger: je ne manquerai de rien.", 19),
    verse("LUK.2.8", "Il y avait des bergers qui passaient la nuit aux champs.", 42),
    verse("JHN.10.11", "Je suis le bon berger. Le bon berger donne sa vie.", 43),
    verse("JHN.10.16", "J'ai encore d'autres brebis; il y aura un seul troupeau, un seul berger, et il est bon.", 43),
    verse("JHN.3.16", "En effet, Dieu a tant aimé le monde qu'il a donné son Fils.", 43),
    verse("JHN.13.34", "Aimez-vous les uns les autres comme je vous ai aimés.", 43),
    verse("JHN.11.5", "Or Jésus aimait Marthe, sa sœur et Lazare.", 43),
    verse("1JN.4.8", "Celui qui n'aime pas n'a pas connu Dieu, car Dieu est amour.", 61),
    verse("LUK.1.27", "vers une vierge fiancée à un homme appelé Joseph.", 42),
    verse("1CO.13.13", "Maintenant donc ces trois choses restent: la foi, l'espérance, l'amour.", 46),
    verse("GEN.18.32", "Que le Seigneur ne s'irrite pas, je ne parlerai plus que cette fois.", 1),
    verse("JHN.11.25", "Je suis la résurrection et la vie.", 43),
    verse("DAN.6.8", "Une restriction fut établie par le roi.", 27),
  ];
  const q = (query: string) => searchVersesCascade(c, query, { profile: S21_FR_PROFILE, limit: 40 });
  const ids = (r: S21SearchResult) => r.results.map((h) => h.verse.usfm);

  // Plural: « ange » também encontra « anges » (forma exata primeiro).
  assert.deepEqual(ids(q("ange")), ["GEN.16.7", "GEN.19.1"]);
  // Verbo em -er: « aimer » encontra aime/aimait/aimez/aimé.
  assert.deepEqual(new Set(ids(q("aimer"))), new Set(["JHN.3.16", "JHN.13.34", "JHN.11.5", "1JN.4.8"]));
  // Frase primeiro, depois as palavras separadas (sem cortar resultados).
  assert.deepEqual(ids(q("bon berger")), ["JHN.10.11", "JHN.10.16"]);
  // Forma exata antes das outras formas (berger antes de bergers).
  assert.deepEqual(ids(q("berger")).slice(-1), ["LUK.2.8"]);
  // Limites de palavra: « la vie » não apanha « la vierge » como frase.
  assert.equal(ids(q("la vie"))[0], "JHN.11.25");
  assert.ok(!ids(q("la vie")).includes("LUK.1.27"));
  // Entre aspas: só a expressão exata.
  assert.deepEqual(ids(q('"bon berger"')), ["JHN.10.11"]);
  // Palavras curtas não se misturam (foi ≠ fois).
  assert.deepEqual(ids(q("foi")), ["1CO.13.13"]);
  // Erro de escrita: só o grupo mais próximo (résurrection, não restriction).
  const typo = q("resurection");
  assert.equal(typo.matchMode, "fuzzy");
  assert.deepEqual(ids(typo), ["JHN.11.25"]);
  // Início de palavra enquanto se escreve.
  assert.deepEqual(ids(q("resur")), ["JHN.11.25"]);
  // Destaque inclui as formas encontradas.
  assert.ok(q("aimer").matchedTerms.includes("aimait"));
  // Livro do leitor sobe dentro do mesmo nível.
  const pref = searchVersesCascade(c, "berger", { profile: S21_FR_PROFILE, limit: 40, preferBookId: "JHN" });
  assert.equal(pref.results[0]!.verse.bookId, "JHN");
}

console.log("test-s21-search-engine: ok");
