/**
 * Banco de ensaio da pesquisa sobre a S21 completa (data/bible/s21/books).
 * Uso: npx tsx scripts/search-bench/bench.ts [consulta…]
 * Sem argumentos corre o conjunto de consultas de referência.
 */
import { searchVersesCascadeOnIndex } from "../../src/bible/verseSearchEngine.ts";
import { S21_FR_PROFILE } from "../../src/bible/verseSearchProfiles.ts";
import { loadS21Index } from "./bench-index.ts";

const DEFAULT_QUERIES = [
  "amour",
  "Dieu est amour",
  "ange",
  "aimer",
  "pardonner",
  "lumière du monde",
  "la vie",
  "resurection",
  "resur",
  "berger",
  "bon berger",
  "foi espérance amour",
  "eternel",
  "Jesus pleura",
  "\"la vie éternelle\"",
];

const index = loadS21Index();
const queries = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_QUERIES;
console.log(`índice: ${index.verses.length} versículos, ${index.uniqueTokens.length} palavras\n`);
for (const q of queries) {
  const t0 = performance.now();
  const r = searchVersesCascadeOnIndex(index, q, { profile: S21_FR_PROFILE, limit: 5 });
  const ms = (performance.now() - t0).toFixed(1);
  console.log(`« ${q} » → ${r.totalCount} (${r.matchMode}, ${ms} ms) termos=[${r.matchedTerms.slice(0, 6).join(", ")}]`);
  for (const h of r.results.slice(0, 5)) {
    console.log(`   ${h.verse.usfm.padEnd(12)} ${h.verse.raw.slice(0, 90)}`);
  }
}
