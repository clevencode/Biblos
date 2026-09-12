/**
 * Texte biblique Segond 21 (S21) local.
 * GET /api/youversion?action=books
 * GET /api/youversion?action=passage&usfm=JHN.3
 * GET /api/youversion?action=search&q=parole&limit=40
 * GET /api/youversion?action=book&usfm=JHN  (livre JSON complet — téléchargement hors ligne)
 *
 * Données : data/bible/s21/books/{OSIS}.json
 * Régénérer : node scripts/convert-s21.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S21_BOOKS_DIR = join(ROOT, "data", "bible", "s21", "books");

const BIBLE_META = {
  id: 0,
  abbreviation: "S21",
  title: "Segond 21",
  languageCode: "fr",
};

/** Canon protestant : USFM (app) ↔ OSIS (fichiers) + titres FR + nb de chapitres (numérotation S21). */
const CANON = [
  ["GEN", "Gen", "Genèse", 50],
  ["EXO", "Exod", "Exode", 40],
  ["LEV", "Lev", "Lévitique", 27],
  ["NUM", "Num", "Nombres", 36],
  ["DEU", "Deut", "Deutéronome", 34],
  ["JOS", "Josh", "Josué", 24],
  ["JDG", "Judg", "Juges", 21],
  ["RUT", "Ruth", "Ruth", 4],
  ["1SA", "1Sam", "1 Samuel", 31],
  ["2SA", "2Sam", "2 Samuel", 24],
  ["1KI", "1Kgs", "1 Rois", 22],
  ["2KI", "2Kgs", "2 Rois", 25],
  ["1CH", "1Chr", "1 Chroniques", 29],
  ["2CH", "2Chr", "2 Chroniques", 36],
  ["EZR", "Ezra", "Esdras", 10],
  ["NEH", "Neh", "Néhémie", 13],
  ["EST", "Esth", "Esther", 10],
  ["JOB", "Job", "Job", 42],
  ["PSA", "Ps", "Psaumes", 150],
  ["PRO", "Prov", "Proverbes", 31],
  ["ECC", "Eccl", "Ecclésiaste", 12],
  ["SNG", "Song", "Cantique des cantiques", 8],
  ["ISA", "Isa", "Ésaïe", 66],
  ["JER", "Jer", "Jérémie", 52],
  ["LAM", "Lam", "Lamentations", 5],
  ["EZK", "Ezek", "Ézéchiel", 48],
  ["DAN", "Dan", "Daniel", 12],
  ["HOS", "Hos", "Osée", 14],
  ["JOL", "Joel", "Joël", 4],
  ["AMO", "Amos", "Amos", 9],
  ["OBA", "Obad", "Abdias", 1],
  ["JON", "Jonah", "Jonas", 4],
  ["MIC", "Mic", "Michée", 7],
  ["NAM", "Nah", "Nahum", 3],
  ["HAB", "Hab", "Habacuc", 3],
  ["ZEP", "Zeph", "Sophonie", 3],
  ["HAG", "Hag", "Aggée", 2],
  ["ZEC", "Zech", "Zacharie", 14],
  ["MAL", "Mal", "Malachie", 3],
  ["MAT", "Matt", "Matthieu", 28],
  ["MRK", "Mark", "Marc", 16],
  ["LUK", "Luke", "Luc", 24],
  ["JHN", "John", "Jean", 21],
  ["ACT", "Acts", "Actes", 28],
  ["ROM", "Rom", "Romains", 16],
  ["1CO", "1Cor", "1 Corinthiens", 16],
  ["2CO", "2Cor", "2 Corinthiens", 13],
  ["GAL", "Gal", "Galates", 6],
  ["EPH", "Eph", "Éphésiens", 6],
  ["PHP", "Phil", "Philippiens", 4],
  ["COL", "Col", "Colossiens", 4],
  ["1TH", "1Thess", "1 Thessaloniciens", 5],
  ["2TH", "2Thess", "2 Thessaloniciens", 3],
  ["1TI", "1Tim", "1 Timothée", 6],
  ["2TI", "2Tim", "2 Timothée", 4],
  ["TIT", "Titus", "Tite", 3],
  ["PHM", "Phlm", "Philémon", 1],
  ["HEB", "Heb", "Hébreux", 13],
  ["JAS", "Jas", "Jacques", 5],
  ["1PE", "1Pet", "1 Pierre", 5],
  ["2PE", "2Pet", "2 Pierre", 3],
  ["1JN", "1John", "1 Jean", 5],
  ["2JN", "2John", "2 Jean", 1],
  ["3JN", "3John", "3 Jean", 1],
  ["JUD", "Jude", "Jude", 1],
  ["REV", "Rev", "Apocalypse", 22],
];

const byUsfm = new Map(CANON.map((row) => [row[0], row]));

const bookJsonCache = new Map();
const BOOK_CACHE_MS = 6 * 60 * 60_000;

function cleanVerseText(text) {
  return String(text || "")
    .replace(/''/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function listBooks() {
  return CANON.map(([usfm, osis, title, chapterCount]) => ({
    id: usfm,
    title,
    fullTitle: title,
    abbreviation: usfm,
    chapters: Array.from({ length: chapterCount }, (_, i) => {
      const id = String(i + 1);
      return { id, passageId: `${usfm}.${id}`, title: null };
    }),
    osis,
  }));
}

function parseUsfmRef(usfm) {
  const normalized = String(usfm || "")
    .trim()
    .toUpperCase()
    .replace(/:/g, ".");
  const [book = "JHN", chapterRaw = "1", versePart] = normalized.split(".");
  const chapter = Number(chapterRaw);
  let verseStart = null;
  let verseEnd = null;
  if (versePart) {
    const [a, b] = String(versePart).split("-");
    verseStart = Number(a);
    verseEnd = b ? Number(b) : verseStart;
  }
  return {
    book,
    chapter: Number.isFinite(chapter) && chapter > 0 ? chapter : 1,
    verseStart: Number.isFinite(verseStart) ? verseStart : null,
    verseEnd: Number.isFinite(verseEnd) ? verseEnd : null,
  };
}

async function loadBook(osis) {
  const cached = bookJsonCache.get(osis);
  if (cached && Date.now() - cached.at < BOOK_CACHE_MS) return cached.json;

  const file = join(S21_BOOKS_DIR, `${osis}.json`);
  try {
    const raw = await readFile(file, "utf8");
    const json = JSON.parse(raw);
    if (!json || !Array.isArray(json.chapters)) {
      throw new Error("JSON S21 invalide");
    }
    bookJsonCache.set(osis, { at: Date.now(), json });
    return json;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(
      message.includes("ENOENT") || message.includes("no such file")
        ? `Livre S21 introuvable : ${osis}`
        : message,
    );
    wrapped.statusCode = message.includes("ENOENT") ? 404 : 500;
    throw wrapped;
  }
}

function chapterFromBook(bookJson, chapter, verseStart, verseEnd) {
  const found = (bookJson.chapters ?? []).find((item) => Number(item.chapter) === chapter);
  if (!found) return null;
  let verses = (found.verses ?? [])
    .map((verse) => ({
      number: Number(verse.number),
      text: cleanVerseText(verse.text),
    }))
    .filter((verse) => Number.isFinite(verse.number) && verse.text);
  if (verseStart != null) {
    const end = verseEnd ?? verseStart;
    verses = verses.filter((verse) => verse.number >= verseStart && verse.number <= end);
  }
  return verses;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function makeSnippet(text, queryNorm, radius = 60) {
  const raw = String(text || "");
  const norm = normalizeSearchText(raw);
  const idx = norm.indexOf(queryNorm);
  if (idx < 0) {
    return raw.length > radius * 2 ? `${raw.slice(0, radius * 2).trim()}…` : raw;
  }
  // Map approx char index from normalized string back to raw (accents inflate raw).
  const ratio = raw.length / Math.max(1, norm.length);
  const center = Math.round(idx * ratio);
  const start = Math.max(0, center - radius);
  const end = Math.min(raw.length, center + queryNorm.length * ratio + radius);
  const slice = raw.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < raw.length ? "…" : ""}`;
}

/** Score: mot entier > début de mot > substring. */
function matchRank(normText, queryNorm) {
  if (!queryNorm) return 99;
  const reWord = new RegExp(`(?:^|[^a-z0-9])${queryNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`);
  if (reWord.test(` ${normText} `)) return 0;
  if (normText.startsWith(queryNorm) || new RegExp(`(?:^|[^a-z0-9])${queryNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(normText)) {
    return 1;
  }
  return 2;
}

/** Index mémoire : texte normalisé une fois pour recherches suivantes. */
let searchIndex = null;
let searchIndexPromise = null;

async function buildSearchIndex() {
  /** @type {{ usfm: string, bookTitle: string, chapter: number, verse: number, text: string, norm: string }[]} */
  const rows = [];
  for (const [usfm, osis, title] of CANON) {
    let bookJson;
    try {
      bookJson = await loadBook(osis);
    } catch {
      continue;
    }
    for (const chapter of bookJson.chapters ?? []) {
      const chapterNum = Number(chapter.chapter);
      if (!Number.isFinite(chapterNum)) continue;
      for (const verse of chapter.verses ?? []) {
        const number = Number(verse.number);
        const text = cleanVerseText(verse.text);
        if (!Number.isFinite(number) || !text) continue;
        rows.push({
          usfm: `${usfm}.${chapterNum}.${number}`,
          bookTitle: title,
          chapter: chapterNum,
          verse: number,
          text,
          norm: normalizeSearchText(text),
        });
      }
    }
  }
  return rows;
}

async function getSearchIndex() {
  if (searchIndex) return searchIndex;
  if (!searchIndexPromise) {
    searchIndexPromise = buildSearchIndex()
      .then((rows) => {
        searchIndex = rows;
        return rows;
      })
      .catch((err) => {
        searchIndexPromise = null;
        throw err;
      });
  }
  return searchIndexPromise;
}

async function searchVerses(q, limit = 40) {
  const query = String(q || "").trim();
  const queryNorm = normalizeSearchText(query);
  if (queryNorm.length < 2) {
    return { q: query, total: 0, results: [] };
  }
  const capped = Math.min(80, Math.max(1, Number(limit) || 40));
  const index = await getSearchIndex();
  const bookOrder = new Map(CANON.map((row, i) => [row[0], i]));
  const hits = [];
  for (const row of index) {
    if (!row.norm.includes(queryNorm)) continue;
    const book = String(row.usfm).split(".")[0];
    hits.push({
      usfm: row.usfm,
      bookTitle: row.bookTitle,
      chapter: row.chapter,
      verse: row.verse,
      text: row.text,
      snippet: makeSnippet(row.text, queryNorm),
      _rank: matchRank(row.norm, queryNorm),
      _book: bookOrder.get(book) ?? 999,
    });
  }
  hits.sort(
    (a, b) =>
      a._rank - b._rank ||
      a._book - b._book ||
      a.chapter - b.chapter ||
      a.verse - b.verse,
  );
  const results = hits.slice(0, capped).map(({ _rank, _book, ...rest }) => rest);
  return { q: query, total: hits.length, results };
}

async function fetchPassagePayload(usfm) {
  const ref = parseUsfmRef(usfm);
  const meta = byUsfm.get(ref.book);
  if (!meta) {
    throw new Error(`Livre inconnu : ${ref.book}`);
  }
  const [, osis, title] = meta;
  const bookJson = await loadBook(osis);
  const verses = chapterFromBook(bookJson, ref.chapter, ref.verseStart, ref.verseEnd);
  if (!verses?.length) {
    throw new Error("Passage introuvable");
  }
  const label =
    ref.verseStart != null
      ? `${title} ${ref.chapter}.${ref.verseStart}${ref.verseEnd && ref.verseEnd !== ref.verseStart ? `-${ref.verseEnd}` : ""}`
      : `${title} ${ref.chapter}`;
  return {
    bibleId: BIBLE_META.id,
    bible: BIBLE_META,
    usingFallback: false,
    passage: {
      id: `${ref.book}.${ref.chapter}`,
      content: verses.map((verse) => verse.text).join(" "),
      reference: label,
      verses,
    },
  };
}

export async function handleYouVersion(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "méthode invalide" }));
    return;
  }

  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);
  const action = url.searchParams.get("action") || "passage";

  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };

  try {
    if (action === "resolve" || action === "test") {
      let sample = null;
      if (action === "test") {
        const result = await fetchPassagePayload("JHN.3.16");
        sample = result.passage;
      }
      send(200, {
        ok: true,
        hasKey: true,
        bible: BIBLE_META,
        usingFallback: false,
        sample,
      });
      return;
    }

    if (action === "books") {
      send(200, {
        ok: true,
        hasKey: true,
        bible: BIBLE_META,
        usingFallback: false,
        books: listBooks(),
      });
      return;
    }

    if (action === "search") {
      const q = String(url.searchParams.get("q") || "");
      const limit = Number(url.searchParams.get("limit") || 40);
      const payload = await searchVerses(q, limit);
      send(200, {
        ok: true,
        hasKey: true,
        bible: BIBLE_META,
        ...payload,
      });
      return;
    }

    if (action === "book") {
      const usfm = String(url.searchParams.get("usfm") || "")
        .trim()
        .toUpperCase()
        .split(".")[0];
      const meta = byUsfm.get(usfm);
      if (!meta) {
        send(200, { ok: false, hasKey: true, error: `Livre inconnu : ${usfm || "?"}` });
        return;
      }
      const [, osis] = meta;
      const bookJson = await loadBook(osis);
      send(200, {
        ok: true,
        hasKey: true,
        bible: BIBLE_META,
        usfm,
        book: bookJson,
      });
      return;
    }

    const usfm = String(url.searchParams.get("usfm") || "JHN.3.16");
    const payload = await fetchPassagePayload(usfm);
    send(200, {
      ok: true,
      hasKey: true,
      ...payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(200, { ok: false, hasKey: true, error: message });
  }
}

export default async function handler(req, res) {
  await handleYouVersion(req, res);
}
