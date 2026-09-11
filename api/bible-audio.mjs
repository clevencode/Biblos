/**
 * Catalogue audio S21 (Anchor RSS) — un épisode = un livre entier.
 * GET /api/bible-audio
 */
const RSS_URL = "https://anchor.fm/s/1123d1c98/podcast/rss";

/** Titres FR du podcast → USFM (après normalisation). */
const TITLE_TO_USFM = {
  genese: "GEN",
  exode: "EXO",
  levitique: "LEV",
  nombres: "NUM",
  deuteronome: "DEU",
  josue: "JOS",
  juges: "JDG",
  ruth: "RUT",
  "1 samuel": "1SA",
  "2 samuel": "2SA",
  "1 rois": "1KI",
  "2 rois": "2KI",
  "1 chroniques": "1CH",
  "2 chroniques": "2CH",
  esdras: "EZR",
  nehemie: "NEH",
  esther: "EST",
  job: "JOB",
  psaumes: "PSA",
  psaume: "PSA",
  proverbes: "PRO",
  eccleiaste: "ECC",
  ecclesiaste: "ECC",
  "cantique des cantiques": "SNG",
  cantique: "SNG",
  esaie: "ISA",
  jeremie: "JER",
  lamentations: "LAM",
  ezechiel: "EZK",
  daniel: "DAN",
  osee: "HOS",
  joel: "JOL",
  amos: "AMO",
  abdias: "OBA",
  jonas: "JON",
  michee: "MIC",
  nahum: "NAM",
  habacuc: "HAB",
  sophonie: "ZEP",
  aggee: "HAG",
  zacharie: "ZEC",
  malachie: "MAL",
  matthieu: "MAT",
  marc: "MRK",
  luc: "LUK",
  jean: "JHN",
  actes: "ACT",
  romains: "ROM",
  "1 corinthiens": "1CO",
  "2 corinthiens": "2CO",
  galates: "GAL",
  ephesiens: "EPH",
  philippiens: "PHP",
  colossiens: "COL",
  "1 thessaloniciens": "1TH",
  "2 thessaloniciens": "2TH",
  "1 timothee": "1TI",
  "2 timothee": "2TI",
  tite: "TIT",
  philemon: "PHM",
  hebreux: "HEB",
  jacques: "JAS",
  "1 pierre": "1PE",
  "2 pierre": "2PE",
  "1 jean": "1JN",
  "2 jean": "2JN",
  "3 jean": "3JN",
  jude: "JUD",
  apocalypse: "REV",
};

let cache = null;
const CACHE_MS = 30 * 60_000;

function normalizeTitle(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cdataOrText(block, tag) {
  const cdata = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"));
  if (cdata) return cdata[1].trim();
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return plain ? plain[1].replace(/<[^>]+>/g, "").trim() : "";
}

function parseRssItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = re.exec(xml))) {
    const block = match[1];
    const title = cdataOrText(block, "title");
    const enc = block.match(/<enclosure[^>]*\burl=["']([^"']+)["']/i);
    const duration = block.match(/<itunes:duration[^>]*>([^<]+)<\/itunes:duration>/i)?.[1]?.trim() || null;
    const guid = cdataOrText(block, "guid") || null;
    if (!title || !enc?.[1]) continue;
    items.push({
      title,
      audioUrl: enc[1],
      duration,
      guid,
    });
  }
  return items;
}

function buildCatalog(items) {
  /** @type {Record<string, { usfm: string, title: string, audioUrl: string, duration: string | null, guid: string | null }>} */
  const byUsfm = {};
  for (const item of items) {
    const key = normalizeTitle(item.title);
    const usfm = TITLE_TO_USFM[key];
    if (!usfm) continue;
    byUsfm[usfm] = {
      usfm,
      title: item.title,
      audioUrl: item.audioUrl,
      duration: item.duration,
      guid: item.guid,
    };
  }
  return byUsfm;
}

async function loadCatalog() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const response = await fetch(RSS_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
  });
  if (!response.ok) {
    throw new Error(`RSS audio HTTP ${response.status}`);
  }
  const xml = await response.text();
  const items = parseRssItems(xml);
  const byUsfm = buildCatalog(items);
  const data = {
    source: RSS_URL,
    podcast: "Bible | Podcast.s21",
    scope: "book",
    books: byUsfm,
    count: Object.keys(byUsfm).length,
  };
  cache = { at: Date.now(), data };
  return data;
}

export async function handleBibleAudio(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "méthode invalide" }));
    return;
  }

  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };

  try {
    const catalog = await loadCatalog();
    send(200, { ok: true, ...catalog });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(200, { ok: false, error: message, books: {}, count: 0 });
  }
}

export default async function handler(req, res) {
  await handleBibleAudio(req, res);
}
