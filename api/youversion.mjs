/**
 * Texte biblique LSG depuis midvash/bible-data (domaine public).
 * GET /api/youversion?action=books
 * GET /api/youversion?action=passage&usfm=JHN.3
 *
 * Source: https://github.com/midvash/bible-data  (versions/fr/lsg)
 */
const DATA_BASES = [
  "https://cdn.jsdelivr.net/gh/midvash/bible-data@main/versions/fr/lsg/books",
  "https://raw.githubusercontent.com/midvash/bible-data/main/versions/fr/lsg/books",
];

const LSG_META = {
  id: 0,
  abbreviation: "LSG",
  title: "Louis Segond 1910",
  languageCode: "fr",
};

/** Canon protestant : USFM (app) ↔ OSIS (bible-data) + titres FR + nb de chapitres. */
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
  ["JOL", "Joel", "Joël", 3],
  ["AMO", "Amos", "Amos", 9],
  ["OBA", "Obad", "Abdias", 1],
  ["JON", "Jonah", "Jonas", 4],
  ["MIC", "Mic", "Michée", 7],
  ["NAM", "Nah", "Nahum", 3],
  ["HAB", "Hab", "Habacuc", 3],
  ["ZEP", "Zeph", "Sophonie", 3],
  ["HAG", "Hag", "Aggée", 2],
  ["ZEC", "Zech", "Zacharie", 14],
  ["MAL", "Mal", "Malachie", 4],
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const err = new Error(
      response.status === 404 ? "Livre introuvable dans bible-data" : `bible-data HTTP ${response.status}`,
    );
    err.statusCode = response.status;
    throw err;
  }
  return response.json();
}

async function loadBook(osis) {
  const cached = bookJsonCache.get(osis);
  if (cached && Date.now() - cached.at < BOOK_CACHE_MS) return cached.json;

  let lastErr = null;
  for (const base of DATA_BASES) {
    try {
      const json = await fetchJson(`${base}/${osis}.json`);
      if (!json || !Array.isArray(json.chapters)) {
        throw new Error("JSON bible-data invalide");
      }
      bookJsonCache.set(osis, { at: Date.now(), json });
      return json;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("bible-data indisponible");
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
    bibleId: LSG_META.id,
    bible: LSG_META,
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
        bible: LSG_META,
        usingFallback: false,
        sample,
      });
      return;
    }

    if (action === "books") {
      send(200, {
        ok: true,
        hasKey: true,
        bible: LSG_META,
        usingFallback: false,
        books: listBooks(),
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
