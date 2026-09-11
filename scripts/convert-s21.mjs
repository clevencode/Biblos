/**
 * Converte o export MySword S21 → data/bible/s21/books/{OSIS}.json
 *
 * Usage:
 *   node scripts/convert-s21.mjs [chemin-source.json]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "bible", "s21");
const BOOKS_DIR = join(OUT_DIR, "books");

const DEFAULT_SOURCE = resolve(
  process.env.USERPROFILE || process.env.HOME || "",
  "Downloads",
  "french_bible_segond_21_s21",
  "French Bible Segond 21 (S21).json",
);

/** USFM, OSIS, titre FR — ordre canon protestant (index MySword 0..65). */
const CANON = [
  ["GEN", "Gen", "Genèse"],
  ["EXO", "Exod", "Exode"],
  ["LEV", "Lev", "Lévitique"],
  ["NUM", "Num", "Nombres"],
  ["DEU", "Deut", "Deutéronome"],
  ["JOS", "Josh", "Josué"],
  ["JDG", "Judg", "Juges"],
  ["RUT", "Ruth", "Ruth"],
  ["1SA", "1Sam", "1 Samuel"],
  ["2SA", "2Sam", "2 Samuel"],
  ["1KI", "1Kgs", "1 Rois"],
  ["2KI", "2Kgs", "2 Rois"],
  ["1CH", "1Chr", "1 Chroniques"],
  ["2CH", "2Chr", "2 Chroniques"],
  ["EZR", "Ezra", "Esdras"],
  ["NEH", "Neh", "Néhémie"],
  ["EST", "Esth", "Esther"],
  ["JOB", "Job", "Job"],
  ["PSA", "Ps", "Psaumes"],
  ["PRO", "Prov", "Proverbes"],
  ["ECC", "Eccl", "Ecclésiaste"],
  ["SNG", "Song", "Cantique des cantiques"],
  ["ISA", "Isa", "Ésaïe"],
  ["JER", "Jer", "Jérémie"],
  ["LAM", "Lam", "Lamentations"],
  ["EZK", "Ezek", "Ézéchiel"],
  ["DAN", "Dan", "Daniel"],
  ["HOS", "Hos", "Osée"],
  ["JOL", "Joel", "Joël"],
  ["AMO", "Amos", "Amos"],
  ["OBA", "Obad", "Abdias"],
  ["JON", "Jonah", "Jonas"],
  ["MIC", "Mic", "Michée"],
  ["NAM", "Nah", "Nahum"],
  ["HAB", "Hab", "Habacuc"],
  ["ZEP", "Zeph", "Sophonie"],
  ["HAG", "Hag", "Aggée"],
  ["ZEC", "Zech", "Zacharie"],
  ["MAL", "Mal", "Malachie"],
  ["MAT", "Matt", "Matthieu"],
  ["MRK", "Mark", "Marc"],
  ["LUK", "Luke", "Luc"],
  ["JHN", "John", "Jean"],
  ["ACT", "Acts", "Actes"],
  ["ROM", "Rom", "Romains"],
  ["1CO", "1Cor", "1 Corinthiens"],
  ["2CO", "2Cor", "2 Corinthiens"],
  ["GAL", "Gal", "Galates"],
  ["EPH", "Eph", "Éphésiens"],
  ["PHP", "Phil", "Philippiens"],
  ["COL", "Col", "Colossiens"],
  ["1TH", "1Thess", "1 Thessaloniciens"],
  ["2TH", "2Thess", "2 Thessaloniciens"],
  ["1TI", "1Tim", "1 Timothée"],
  ["2TI", "2Tim", "2 Timothée"],
  ["TIT", "Titus", "Tite"],
  ["PHM", "Phlm", "Philémon"],
  ["HEB", "Heb", "Hébreux"],
  ["JAS", "Jas", "Jacques"],
  ["1PE", "1Pet", "1 Pierre"],
  ["2PE", "2Pet", "2 Pierre"],
  ["1JN", "1John", "1 Jean"],
  ["2JN", "2John", "2 Jean"],
  ["3JN", "3John", "3 Jean"],
  ["JUD", "Jude", "Jude"],
  ["REV", "Rev", "Apocalypse"],
];

function escapeNewlinesInStrings(s) {
  let out = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!inStr) {
      if (ch === '"') inStr = true;
      out += ch;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      if (i + 1 < s.length) {
        out += s[i + 1];
        i++;
      }
      continue;
    }
    if (ch === '"') {
      inStr = false;
      out += ch;
      continue;
    }
    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\r";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }
    out += ch;
  }
  return out;
}

function parseMySword(raw) {
  const fixed = escapeNewlinesInStrings(raw.replace(/^\uFEFF/, ""));
  // MySword = littéral objet JS (clés non quotées)
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${fixed});`)();
}

function cleanVerseText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/''/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function verseNumber(verse, index) {
  const id = verse?.ID ?? verse?.Id ?? verse?.id;
  if (id != null && Number.isFinite(Number(id))) return Number(id);
  return index + 1;
}

function convertBook(book, bookIndex) {
  const [usfm, osis, title] = CANON[bookIndex];
  const chaptersIn = book.Chapters || book.chapters || [];
  const chapters = chaptersIn.map((chap, ci) => {
    const versesIn = chap.Verses || chap.verses || [];
    const verses = versesIn
      .map((verse, vi) => ({
        number: verseNumber(verse, vi),
        text: cleanVerseText(verse?.Text ?? verse?.text ?? verse),
      }))
      .filter((v) => v.text);
    return { chapter: ci + 1, verses };
  });
  return {
    version: "s21",
    book: osis,
    usfm,
    bookId: bookIndex + 1,
    title,
    chapters,
  };
}

async function main() {
  const sourcePath = resolve(process.argv[2] || DEFAULT_SOURCE);
  console.log("Source:", sourcePath);

  const raw = await readFile(sourcePath, "utf8");
  const data = parseMySword(raw);
  const testaments = data.Testaments || [];
  const flatBooks = testaments.flatMap((t) => t.Books || []);

  if (flatBooks.length !== CANON.length) {
    throw new Error(
      `Attendu ${CANON.length} livres, trouvé ${flatBooks.length}`,
    );
  }

  await mkdir(BOOKS_DIR, { recursive: true });

  const manifestBooks = [];
  let totalVerses = 0;

  for (let i = 0; i < flatBooks.length; i++) {
    const converted = convertBook(flatBooks[i], i);
    const verseCount = converted.chapters.reduce(
      (n, c) => n + c.verses.length,
      0,
    );
    totalVerses += verseCount;
    manifestBooks.push({
      usfm: converted.usfm,
      osis: converted.book,
      title: converted.title,
      bookId: converted.bookId,
      chapters: converted.chapters.length,
      verses: verseCount,
    });
    const outFile = join(BOOKS_DIR, `${converted.book}.json`);
    await writeFile(outFile, `${JSON.stringify(converted, null, 2)}\n`, "utf8");
    console.log(
      `  ${converted.book}.json — ${converted.chapters.length} ch, ${verseCount} v`,
    );
  }

  const manifest = {
    abbreviation: "S21",
    title: data.Text || "Segond 21",
    languageCode: "fr",
    publisher: String(data.Publisher || "")
      .replace(/\r\n/g, "\n")
      .trim(),
    versionDate: data.VersionDate || null,
    guid: data.Guid || null,
    books: manifestBooks,
    totals: {
      books: manifestBooks.length,
      chapters: manifestBooks.reduce((n, b) => n + b.chapters, 0),
      verses: totalVerses,
    },
    sourceNote: "MySword S21 export → convert-s21.mjs",
    convertedAt: new Date().toISOString(),
  };

  await writeFile(
    join(OUT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `OK — ${manifest.totals.books} livres, ${manifest.totals.chapters} ch, ${manifest.totals.verses} versets → ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
