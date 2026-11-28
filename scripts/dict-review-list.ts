/**
 * Lista de revisão: entradas do Vilsen mais consultadas pelo leitor HT98 (80% das consultas),
 * com o gloss atual, sinais de problema e o trecho do OCR bruto (Creo.txt) para comparar.
 * Usage: npx tsx scripts/dict-review-list.ts <Creo.txt (só a parte 2, Vilsen)> <out.md>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { buildHtDictionary, lookupHtWord, type HtDictEntry } from "../src/bible/htDictionary.ts";

const [srcPath, outPath] = process.argv.slice(2);
const dict = buildHtDictionary(
  JSON.parse(readFileSync("data/bible/study/dict/ht-vilsen.json", "utf8")),
  JSON.parse(readFileSync("data/bible/study/dict/ht-aliases.json", "utf8")),
);
const bible = JSON.parse(readFileSync("public/bibles/ht1998.json", "utf8"));
const srcLines = readFileSync(srcPath!, "utf8").split(/\r?\n/);

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// --- Consultas por entrada (cada ocorrência no HT98 = 1 consulta possível) ---
const hits = new Map<number, number>();
const forms = new Map<number, Map<string, number>>();
const cache = new Map<string, number[]>();
for (const b of bible.books) for (const c of b.chapters) for (const v of c.verses)
  for (const w of String(v.text).normalize("NFC").split(/[^\p{L}\p{M}]+/u)) {
    if (!w) continue;
    const k = w.toLowerCase();
    let ids = cache.get(k);
    if (!ids) { ids = lookupHtWord(dict, k).entries.map((e) => e.id); cache.set(k, ids); }
    for (const id of ids) {
      hits.set(id, (hits.get(id) ?? 0) + 1);
      const f = forms.get(id) ?? new Map<string, number>();
      f.set(k, (f.get(k) ?? 0) + 1);
      forms.set(id, f);
    }
  }
const byId = new Map(dict.entries.map((e) => [e.id, e]));
const ranked = [...hits].sort((a, b) => b[1] - a[1]);
const sum = ranked.reduce((s, [, n]) => s + n, 0);
const top: { e: HtDictEntry; n: number; cum: number }[] = [];
let acc = 0;
for (const [id, n] of ranked) {
  acc += n;
  top.push({ e: byId.get(id)!, n, cum: acc / sum });
  if (acc / sum >= 0.8) break;
}

// --- Sinais de problema ---
function flags(e: HtDictEntry): string[] {
  const out: string[] = [];
  const g = e.gloss;
  if (/[ėēı]/.test(g)) out.push("ocr-chars");
  if (/Pagina \d+ \/ 511|Diksyon[eè] Krey[oò]l Vilsen|(^|\s)-\d{1,3}-(\s|$)/.test(g)) out.push("cabecalho-pagina");
  const nums = [...g.matchAll(/(?:^|\s)(\d)\.\s/g)].map((x) => Number(x[1]));
  if (nums.length >= 2 && nums.some((n, i) => i > 0 && n !== nums[i - 1]! + 1)) out.push("numeracao");
  if (/[\p{L}]\.:\s/u.test(g)) out.push("entrada-embutida");
  if (g.length < 15) out.push("curto");
  const lemma = fold(e.lemma);
  if (g.length >= 80 && !/\s/.test(lemma)) {
    const stem = lemma.slice(0, Math.max(3, lemma.length - 2));
    if (!fold(g).split(/[^a-z0-9]+/).some((w) => w.startsWith(stem))) out.push("sem-lema");
  }
  return out;
}

// --- Trecho do OCR: cabeçalhos "lema:" ou "lema. pos." (não frases de exemplo) ---
const POS = "(?:n\\s*\\.?\\s*fr|n|v|a|adv|np|prep|pr|konj|kon|pwo|ono|ent|entj|fr|pej|det)";
function ocrExcerpts(e: HtDictEntry): { page: string; lines: string[] }[] {
  const key = fold(e.lemma).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const head = new RegExp(`^${key}\\s*(?::|\\.\\s*(?:\\d\\.\\s*)?${POS}\\s*\\.)`);
  const found: { page: string; lines: string[] }[] = [];
  let page = "?";
  for (let i = 0; i < srcLines.length && found.length < 3; i++) {
    const pm = srcLines[i]!.match(/^----- Pagina (\d+) \/ 511/);
    if (pm) page = pm[1]!;
    if (!head.test(fold(srcLines[i]!.trim()))) continue;
    const lines: string[] = [];
    for (let j = i; j < srcLines.length && lines.length < 12; j++) {
      const l = srcLines[j]!.trim();
      if (!l) continue;
      if (/^----- Pagina/.test(l)) break;
      lines.push(l);
    }
    found.push({ page, lines });
  }
  if (found.length) return found;
  // Fallback: cabeçalho com OCR diferente → localizar pelo início do gloss.
  const probe = fold(e.gloss)
    .replace(/^\s*(?:\d|i)\.\s*/, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  if (probe.split(" ").length < 2) return found;
  page = "?";
  for (let i = 0; i < srcLines.length; i++) {
    const pm = srcLines[i]!.match(/^----- Pagina (\d+) \/ 511/);
    if (pm) page = pm[1]!;
    const lineWords = fold(srcLines[i]!).split(/[^a-z0-9]+/).filter(Boolean).join(" ");
    if (!lineWords.includes(probe)) continue;
    const lines: string[] = [];
    for (let j = Math.max(0, i - 2); j < srcLines.length && lines.length < 12; j++) {
      const l = srcLines[j]!.trim();
      if (!l || /^----- Pagina/.test(l)) continue;
      lines.push(l);
    }
    return [{ page: `${page}, localizado pelo início do gloss`, lines }];
  }
  return found;
}

const md: string[] = [];
md.push("# Revisão do Diksyonè Vilsen — entradas prioritárias do HT98", "");
md.push(
  `As ${top.length} entradas abaixo cobrem **${Math.round(top.at(-1)!.cum * 100)}%** das consultas possíveis no leitor HT98 ` +
    `(${sum.toLocaleString("pt-PT")} ocorrências com entrada; ${ranked.length} entradas distintas alcançadas).`,
  "",
  "Como usar:",
  "1. Compare **Gloss atual** com o **OCR bruto** (as duas colunas da página estão intercaladas linha a linha: as linhas de outra entrada são as que não continuam a frase).",
  "2. Escreva a definição correta em **Correção** (só o texto da definição, sem o lema) e marque a caixa.",
  "3. As correções aplicam-se no repo `dicvilsen` (`data/entries.json`) e voltam ao Biblos com `npm run dict:import`.",
  "",
  "Sinais: `sem-lema` gloss longo sem o próprio lema (mistura de colunas) · `entrada-embutida` outra entrada dentro · `cabecalho-pagina` · `numeracao` sentidos fora de ordem · `ocr-chars` ė/ē/ı · `curto`.",
  "",
);
const flagCount = new Map<string, number>();
let noExcerpt = 0;
top.forEach(({ e, n, cum }, i) => {
  const f = flags(e);
  f.forEach((x) => flagCount.set(x, (flagCount.get(x) ?? 0) + 1));
  const fm = [...(forms.get(e.id) ?? new Map())].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w, c]) => `${w} (${c})`).join(", ");
  const exs = ocrExcerpts(e);
  if (!exs.length) noExcerpt++;
  md.push(`## ${i + 1}. ${e.lemma} \`${e.pos}\` — id ${e.id}`, "");
  md.push(`- **Consultas HT98:** ${n.toLocaleString("pt-PT")} (acumulado ${Math.round(cum * 100)}%) — formas: ${fm}`);
  md.push(`- **Sinais:** ${f.length ? f.map((x) => `\`${x}\``).join(" ") : "nenhum automático (rever mesmo assim)"}`);
  md.push(`- **Gloss atual:** ${e.gloss}`);
  if (exs.length) {
    exs.forEach((ex, k) => {
      const label = exs.length > 1 ? ` — cabeçalho ${k + 1} de ${exs.length}` : "";
      md.push(`- **OCR bruto (pág. ${ex.page}${label}):**`, "", "  ```text", ...ex.lines.map((l) => `  ${l}`), "  ```");
    });
  } else {
    md.push("- **OCR bruto:** cabeçalho não encontrado (lema com OCR diferente no original)");
  }
  md.push("- [ ] **Correção:** ", "");
});

const summary = [...flagCount].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(" · ");
md.splice(4, 0, `Sinais automáticos nas ${top.length} entradas: ${summary || "nenhum"}. Sem trecho de OCR localizado: ${noExcerpt}.`, "");
writeFileSync(outPath!, md.join("\n") + "\n", "utf8");
console.log(JSON.stringify({ entries: top.length, coverage: top.at(-1)!.cum, flags: Object.fromEntries(flagCount), noExcerpt }));
