/**
 * Troca de versão S21 ↔ HT98: mapeamento de livro / capítulo / versículo
 * sobre a estrutura real das duas versões.
 * Usage: npx tsx scripts/test-version-switch.ts
 * Alias: npm run test:version-switch
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  mapPassageBetweenVersions,
  type VersionBookInfo,
} from "../src/bible/versionPassageMap.ts";

const root = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

type Ch = { chapter: number | string; verses: { number: number | string; text: string }[] };
const ht = JSON.parse(readFileSync(root("public/bibles/ht1998.json"), "utf8")) as {
  books: { usfm: string; chapters: Ch[] }[];
};
const htOrder = ht.books.map((b) => b.usfm.toUpperCase());
const htBooks: VersionBookInfo[] = ht.books.map((b) => ({ id: b.usfm.toUpperCase(), chapterCount: b.chapters.length }));
const htText = (b: string, c: number, v: number) =>
  ht.books.find((x) => x.usfm === b)?.chapters.find((x) => +x.chapter === c)?.verses.find((x) => +x.number === v)?.text ?? "";

const s21Dir = root("data/bible/s21/books");
const s21: Record<string, Ch[]> = {};
for (const f of readdirSync(s21Dir)) {
  const j = JSON.parse(readFileSync(`${s21Dir}/${f}`, "utf8"));
  s21[String(j.usfm || j.book || j.id).toUpperCase()] = j.chapters;
}
const s21Order = htOrder.filter((id) => s21[id]);
const s21Books: VersionBookInfo[] = s21Order.map((id) => ({ id, chapterCount: s21[id]!.length }));
const s21Text = (b: string, c: number, v: number) =>
  s21[b]?.find((x) => +x.chapter === c)?.verses.find((x) => +x.number === v)?.text ?? "";

const toHt = (bookId: string, chapter: number, verse: number | null) =>
  mapPassageBetweenVersions({ from: "s21", to: "ht98", passage: { bookId, chapter, verse }, sourceBookOrder: s21Order, targetBooks: htBooks });
const toS21 = (bookId: string, chapter: number, verse: number | null) =>
  mapPassageBetweenVersions({ from: "ht98", to: "s21", passage: { bookId, chapter, verse }, sourceBookOrder: htOrder, targetBooks: s21Books });

// Caso comum: mesmo livro, capítulo e versículo.
assert.deepEqual(toHt("PSA", 119, 100), { bookId: "PSA", chapter: 119, verse: 100, note: null });
assert.deepEqual(toS21("PRO", 4, null), { bookId: "PRO", chapter: 4, verse: null, note: null });

// Joel: S21 3:1 = HT 2:28 (mesmo texto: "Esprit" / "lespri").
{
  const r = toHt("JOL", 3, 1);
  assert.deepEqual(r, { bookId: "JOL", chapter: 2, verse: 28, note: null });
  assert.ok(/Esprit/.test(s21Text("JOL", 3, 1)) && /lespri/.test(htText("JOL", 2, 28)));
  assert.deepEqual(toS21("JOL", 2, 28), { bookId: "JOL", chapter: 3, verse: 1, note: null });
  assert.deepEqual(toS21("JOL", 2, 5), { bookId: "JOL", chapter: 2, verse: 5, note: null });
}
// Joel 4 (S21) = Jowèl 3 (HT) — antes caía num capítulo inexistente.
assert.deepEqual(toHt("JOL", 4, 2), { bookId: "JOL", chapter: 3, verse: 2, note: null });
assert.deepEqual(toS21("JOL", 3, 2), { bookId: "JOL", chapter: 4, verse: 2, note: null });

// Malachie 3:19–24 (S21) = Malachi 4:1–6 (HT).
{
  assert.deepEqual(toHt("MAL", 3, 19), { bookId: "MAL", chapter: 4, verse: 1, note: null });
  assert.deepEqual(toHt("MAL", 3, 10), { bookId: "MAL", chapter: 3, verse: 10, note: null });
  assert.deepEqual(toS21("MAL", 4, 6), { bookId: "MAL", chapter: 3, verse: 24, note: null });
  assert.deepEqual(toS21("MAL", 4, null), { bookId: "MAL", chapter: 3, verse: 19, note: null });
  assert.ok(/four/.test(s21Text("MAL", 3, 19)) && /fou/.test(htText("MAL", 4, 1)));
}

// Deuterocanônicos (só HT98) → equivalente direto ou próximo livro do cânon.
assert.deepEqual(toS21("ESG", 4, 3), { bookId: "EST", chapter: 4, verse: null, note: "book_substituted" });
assert.deepEqual(toS21("DAG", 3, 30), { bookId: "DAN", chapter: 1, verse: null, note: "book_substituted" });
assert.deepEqual(toS21("TOB", 3, 5), { bookId: "EST", chapter: 1, verse: null, note: "book_substituted" });
assert.deepEqual(toS21("SIR", 10, null), { bookId: "ISA", chapter: 1, verse: null, note: "book_substituted" });
assert.deepEqual(toS21("2MA", 2, null), { bookId: "MAT", chapter: 1, verse: null, note: "book_substituted" });

// Ida e volta não perde a posição em nenhum capítulo comum (todos os livros).
{
  let checked = 0;
  for (const b of s21Books) {
    for (let c = 1; c <= b.chapterCount; c++) {
      const there = toHt(b.id, c, 1);
      assert.notEqual(there.note, "book_substituted", `${b.id} ${c}`);
      const back = toS21(there.bookId, there.chapter, there.verse);
      assert.equal(`${back.bookId} ${back.chapter}`, `${b.id} ${c}`, `ida e volta ${b.id} ${c}`);
      checked++;
    }
  }
  // Todos os capítulos de destino existem.
  for (const b of s21Books) for (let c = 1; c <= b.chapterCount; c++) {
    const r = toHt(b.id, c, null);
    assert.ok(r.chapter <= htBooks.find((x) => x.id === r.bookId)!.chapterCount, `${b.id} ${c} → ${r.chapter}`);
  }
  console.log(`ida e volta S21 → HT98 → S21: ${checked} capítulos ok`);
}

console.log("test-version-switch: ok");
