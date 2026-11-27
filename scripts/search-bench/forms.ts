/** Mostra as formas geradas por termo (precisão da flexão). */
import { frenchInflections } from "../../src/bible/verseSearchVariants.ts";
import { loadS21Index } from "./bench-index.ts";
const index = loadS21Index();
const has = (w: string) => Boolean(index.tokenMap[w]);
for (const t of process.argv.slice(2)) {
  console.log(`${t.padEnd(10)} → ${frenchInflections(t, has).join(", ") || "(só a forma exata)"}`);
}
