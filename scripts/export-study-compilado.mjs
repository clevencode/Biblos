/**
 * Extrai TSKe (références croisées) de estudo-biblia-compilado.txt
 * (Sg1910 / Strong removidos do projeto.)
 *
 * Usage:
 *   node scripts/export-study-compilado.mjs [caminho-compilado.txt]
 */
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "bible", "study");
const DEFAULT_COMPILADO = resolve(
  process.env.USERPROFILE || process.env.HOME || "",
  "Downloads",
  "estudo-biblia-compilado.txt",
);

const BOOK_TO_USFM = new Map(
  [
    ["Gen", "GEN"],
    ["Exo", "EXO"],
    ["Exod", "EXO"],
    ["Lev", "LEV"],
    ["Num", "NUM"],
    ["Deu", "DEU"],
    ["Deut", "DEU"],
    ["Jos", "JOS"],
    ["Josh", "JOS"],
    ["Jdg", "JDG"],
    ["Judg", "JDG"],
    ["Rut", "RUT"],
    ["Ruth", "RUT"],
    ["1Sa", "1SA"],
    ["1Sam", "1SA"],
    ["2Sa", "2SA"],
    ["2Sam", "2SA"],
    ["1Ki", "1KI"],
    ["1Kgs", "1KI"],
    ["2Ki", "2KI"],
    ["2Kgs", "2KI"],
    ["1Ch", "1CH"],
    ["1Chr", "1CH"],
    ["2Ch", "2CH"],
    ["2Chr", "2CH"],
    ["Ezr", "EZR"],
    ["Ezra", "EZR"],
    ["Neh", "NEH"],
    ["Est", "EST"],
    ["Esth", "EST"],
    ["Job", "JOB"],
    ["Psa", "PSA"],
    ["Ps", "PSA"],
    ["Pro", "PRO"],
    ["Prov", "PRO"],
    ["Ecc", "ECC"],
    ["Eccl", "ECC"],
    ["Sng", "SNG"],
    ["Song", "SNG"],
    ["Isa", "ISA"],
    ["Jer", "JER"],
    ["Lam", "LAM"],
    ["Eze", "EZK"],
    ["Ezek", "EZK"],
    ["Dan", "DAN"],
    ["Hos", "HOS"],
    ["Joe", "JOL"],
    ["Joel", "JOL"],
    ["Amo", "AMO"],
    ["Amos", "AMO"],
    ["Oba", "OBA"],
    ["Obad", "OBA"],
    ["Jon", "JON"],
    ["Jonah", "JON"],
    ["Mic", "MIC"],
    ["Nah", "NAM"],
    ["Hab", "HAB"],
    ["Zep", "ZEP"],
    ["Zeph", "ZEP"],
    ["Hag", "HAG"],
    ["Zec", "ZEC"],
    ["Zech", "ZEC"],
    ["Mal", "MAL"],
    ["Mat", "MAT"],
    ["Matt", "MAT"],
    ["Mar", "MRK"],
    ["Mark", "MRK"],
    ["Luk", "LUK"],
    ["Luke", "LUK"],
    ["Joh", "JHN"],
    ["John", "JHN"],
    ["Jhn", "JHN"],
    ["Act", "ACT"],
    ["Acts", "ACT"],
    ["Rom", "ROM"],
    ["1Co", "1CO"],
    ["1Cor", "1CO"],
    ["2Co", "2CO"],
    ["2Cor", "2CO"],
    ["Gal", "GAL"],
    ["Eph", "EPH"],
    ["Php", "PHP"],
    ["Phil", "PHP"],
    ["Col", "COL"],
    ["1Th", "1TH"],
    ["1Thess", "1TH"],
    ["2Th", "2TH"],
    ["2Thess", "2TH"],
    ["1Ti", "1TI"],
    ["1Tim", "1TI"],
    ["2Ti", "2TI"],
    ["2Tim", "2TI"],
    ["Tit", "TIT"],
    ["Titus", "TIT"],
    ["Phm", "PHM"],
    ["Phlm", "PHM"],
    ["Heb", "HEB"],
    ["Jam", "JAS"],
    ["Jas", "JAS"],
    ["1Pe", "1PE"],
    ["1Pet", "1PE"],
    ["2Pe", "2PE"],
    ["2Pet", "2PE"],
    ["1Jo", "1JN"],
    ["1John", "1JN"],
    ["2Jo", "2JN"],
    ["2John", "2JN"],
    ["3Jo", "3JN"],
    ["3John", "3JN"],
    ["Jud", "JUD"],
    ["Jude", "JUD"],
    ["Rev", "REV"],
  ].map(([k, v]) => [k, v]),
);

const VERSE_LINE = /^([1-3]?[A-Za-z]{2,5})\s+(\d+):(\d+)\s*(.*)$/;

function usfmBook(tag) {
  return BOOK_TO_USFM.get(tag) || tag.toUpperCase();
}

function splitTskeRefs(line) {
  const parts = line
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const part of parts) {
    const ref = part.replace(/^\s+/, "").replace(/\s+$/, "");
    if (!ref || ref.length < 3) continue;
    if (/^Gen\s+\d+:\d+/i.test(ref) && ref.includes(",")) continue;
    out.push(ref);
  }
  return out;
}

async function main() {
  const input = resolve(process.argv[2] || DEFAULT_COMPILADO);
  let mode = null;
  const tskeChapters = new Map();

  let tskeCurrent = null;

  const rl = createInterface({
    input: createReadStream(input, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    if (line.includes("Sg1910 —")) {
      mode = null;
      continue;
    }
    if (line.includes("TSKe —")) {
      mode = "tske";
      continue;
    }
    if (line.includes("LSG —") || line.includes("Louis Segond 1910")) {
      mode = null;
      continue;
    }
    if (line.includes("Nave —")) {
      mode = null;
      continue;
    }
    if (!mode) continue;

    const vm = line.match(VERSE_LINE);
    if (vm) {
      const book = usfmBook(vm[1]);
      const chapter = Number(vm[2]);
      const verse = Number(vm[3]);
      const rest = vm[4] || "";

      if (mode === "tske") {
        const key = `${book}.${chapter}`;
        tskeCurrent = { book, chapter, verse, heading: rest.trim(), lines: [] };
        if (!tskeChapters.has(key)) tskeChapters.set(key, {});
        tskeChapters.get(key)[verse] = tskeCurrent;
      }
      continue;
    }

    if (mode === "tske" && tskeCurrent && line.trim()) {
      tskeCurrent.lines.push(line.trim());
    }
  }

  await mkdir(join(OUT, "tske"), { recursive: true });

  for (const [key, verses] of tskeChapters) {
    const out = {};
    for (const [v, block] of Object.entries(verses)) {
      const refs = [];
      for (const ln of block.lines) {
        refs.push(...splitTskeRefs(ln));
      }
      out[v] = {
        heading: block.heading || undefined,
        refs,
        body: block.lines.join("\n").trim() || undefined,
      };
    }
    await writeFile(join(OUT, "tske", `${key}.json`), JSON.stringify(out));
  }

  const manifest = {
    version: 1,
    generatedFrom: "estudo-biblia-compilado.txt",
    resources: {
      tske: { tier: "A", chapters: tskeChapters.size, format: "tske/{USFM}.{ch}.json" },
    },
    textVersions: ["s21", "ht98"],
    study: ["tske"],
  };
  await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`OK: tske chapters=${tskeChapters.size}, lines=${lineNo}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
