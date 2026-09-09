/**
 * Proxy YouVersion Platform (App Key só no servidor).
 * GET /api/youversion?action=passage&usfm=JHN.3.16
 * GET /api/youversion?action=books
 * GET /api/youversion?action=resolve
 * GET /api/youversion?action=test
 *
 * Portado de Downloads/flashbible (Flutter YouVersionApiClient).
 */
const API_BASE = "https://api.youversion.com/v1";
/** Segond 1910 (Louis Segond) — seule version FR du app. */
const LSG = 93;

const LSG_META = {
  id: LSG,
  abbreviation: "LSG",
  title: "Louis Segond 1910",
  languageCode: "fr",
};

/** Caches mémoire pour réduire le rate limit YouVersion. */
let booksCache = null;
let booksCacheAt = 0;
const BOOKS_CACHE_MS = 60 * 60_000; // 1 h

const passageCache = new Map();
const PASSAGE_CACHE_MS = 30 * 60_000; // 30 min
const PASSAGE_CACHE_MAX = 80;

let queue = Promise.resolve();
let lastYvAt = 0;
const MIN_GAP_MS = 350;

function appKey() {
  return (process.env.YOUVERSION_APP_KEY || process.env.YVP_APP_KEY || "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(input) {
  return String(input || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** YouVersion HTML: <span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>texte… */
function versesFromHtml(html) {
  const raw = String(html || "");
  if (!raw.includes("yv-v")) return null;

  const re =
    /<span\b[^>]*class=["'][^"']*yv-v[^"']*["'][^>]*\bv=["'](\d+)["'][^>]*>\s*<\/span>|<span\b[^>]*\bv=["'](\d+)["'][^>]*class=["'][^"']*yv-v[^"']*["'][^>]*>\s*<\/span>/gi;
  const matches = [...raw.matchAll(re)];
  if (!matches.length) return null;

  const verses = [];
  for (let i = 0; i < matches.length; i += 1) {
    const number = Number(matches[i][1] || matches[i][2]);
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    let chunk = raw.slice(start, end);
    chunk = chunk.replace(/<span[^>]*class=["'][^"']*yv-vlbl[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "");
    chunk = chunk.replace(/<div[^>]*class=["'][^"']*yv-h[^"']*["'][^>]*>[\s\S]*$/i, "");
    const text = stripHtml(chunk);
    if (!Number.isFinite(number) || !text) continue;
    verses.push({ number, text });
  }
  return verses.length ? verses : null;
}

function versesFromPlain(raw) {
  const text = stripHtml(raw);
  if (!text) return null;
  const chunks = text.split(/(?=(?:^|\s)\d{1,3}\s)/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length < 2) return null;
  const verses = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^(\d{1,3})\s+([\s\S]+)$/);
    if (!m) continue;
    verses.push({ number: Number(m[1]), text: m[2].trim() });
  }
  return verses.length >= 2 ? verses : null;
}

function extractVerses(root) {
  if (Array.isArray(root.verses)) {
    const verses = [];
    for (const v of root.verses) {
      if (!v || typeof v !== "object") continue;
      const text = stripHtml(String(v.content ?? v.text ?? ""));
      if (!text) continue;
      const number = Number(v.verse ?? v.number ?? v.id ?? verses.length + 1);
      verses.push({
        number: Number.isFinite(number) ? number : verses.length + 1,
        text,
      });
    }
    if (verses.length) return verses;
  }

  for (const c of [root.content, root.text, root.passage]) {
    if (typeof c !== "string" || !c.trim()) continue;
    if (/<[^>]+>/.test(c)) {
      const fromHtml = versesFromHtml(c);
      if (fromHtml) return fromHtml;
    }
    const fromPlain = versesFromPlain(c);
    if (fromPlain) return fromPlain;
  }
  return null;
}

function extractContent(root) {
  const verses = extractVerses(root);
  if (verses) return verses.map((v) => v.text).join(" ");
  const candidates = [root.content, root.text, root.passage];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return stripHtml(c);
    if (c && typeof c === "object" && typeof c.content === "string") {
      return stripHtml(c.content);
    }
  }
  return "";
}

function parsePassage(json) {
  const root = json?.data && typeof json.data === "object" ? json.data : json;
  const verses = extractVerses(root);
  return {
    id: String(root.id ?? root.passage_id ?? ""),
    content: extractContent(root),
    reference: root.reference ?? root.human ?? root.title ?? null,
    verses,
  };
}

function parseBible(json) {
  const root = json?.data && typeof json.data === "object" ? json.data : json;
  const language = root.language;
  const tag = root.language_tag ? String(root.language_tag) : null;
  return {
    id: Number(root.id),
    abbreviation: String(root.abbreviation ?? root.localized_abbreviation ?? "LSG"),
    title: String(root.localized_title ?? root.title ?? root.name ?? "Louis Segond 1910"),
    languageCode:
      language && typeof language === "object"
        ? String(language.iso_639_1 ?? language.iso_639_3 ?? "")
        : tag?.split("-")[0] ?? "fr",
  };
}

function parseBook(raw) {
  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters.map((c) => ({
        id: String(c.id ?? ""),
        passageId: String(c.passage_id ?? c.id ?? ""),
        title: c.title ? String(c.title) : null,
      }))
    : [];
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? raw.full_title ?? raw.id ?? ""),
    fullTitle: raw.full_title ? String(raw.full_title) : null,
    abbreviation: raw.abbreviation ? String(raw.abbreviation) : null,
    chapters,
  };
}

function rememberPassage(usfm, payload) {
  passageCache.set(usfm, { at: Date.now(), payload });
  while (passageCache.size > PASSAGE_CACHE_MAX) {
    const first = passageCache.keys().next().value;
    passageCache.delete(first);
  }
}

async function yvGet(path, key, { retries = 4 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const waitGap = Math.max(0, MIN_GAP_MS - (Date.now() - lastYvAt));
    if (waitGap) await sleep(waitGap);
    lastYvAt = Date.now();

    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "X-YVP-App-Key": key,
        Accept: "application/json",
      },
    });
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (response.ok) return json;

    const retryAfterRaw = response.headers.get("retry-after");
    const retryAfter = retryAfterRaw ? Number(retryAfterRaw) * 1000 : NaN;
    if (response.status === 429 && attempt < retries - 1) {
      const backoff = Number.isFinite(retryAfter)
        ? Math.min(Math.max(retryAfter, 800), 12_000)
        : Math.min(800 * 2 ** attempt, 8_000);
      await sleep(backoff);
      lastErr = Object.assign(new Error("Rate limit YouVersion"), { statusCode: 429 });
      continue;
    }

    const err = new Error(
      response.status === 401
        ? "App Key YouVersion inválida"
        : response.status === 403
          ? "Acesso negado (licença YouVersion?)"
          : response.status === 404
            ? "Recurso não encontrado"
            : response.status === 429
              ? "Rate limit YouVersion — réessaie dans un instant"
              : `YouVersion HTTP ${response.status}`,
    );
    err.statusCode = response.status;
    throw err;
  }
  throw lastErr || new Error("Rate limit YouVersion");
}

/** Sérialise les appels YouVersion (évite rafales 429). */
function enqueueYv(task) {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function fetchBooksCached(key) {
  const now = Date.now();
  if (booksCache && now - booksCacheAt < BOOKS_CACHE_MS) {
    return booksCache;
  }
  return enqueueYv(async () => {
    if (booksCache && Date.now() - booksCacheAt < BOOKS_CACHE_MS) return booksCache;
    const json = await yvGet(`/bibles/${LSG}/books`, key);
    const list = Array.isArray(json.data) ? json.data : Array.isArray(json.books) ? json.books : [];
    const payload = {
      bible: LSG_META,
      books: list.map(parseBook),
    };
    booksCache = payload;
    booksCacheAt = Date.now();
    return payload;
  });
}

async function fetchPassageCached(key, usfm) {
  const cached = passageCache.get(usfm);
  if (cached && Date.now() - cached.at < PASSAGE_CACHE_MS) {
    return cached.payload;
  }
  return enqueueYv(async () => {
    const again = passageCache.get(usfm);
    if (again && Date.now() - again.at < PASSAGE_CACHE_MS) return again.payload;
    const json = await yvGet(
      `/bibles/${LSG}/passages/${encodeURIComponent(usfm)}?format=html&include_headings=true`,
      key,
    );
    const payload = {
      bibleId: LSG,
      bible: LSG_META,
      usingFallback: false,
      passage: parsePassage(json),
    };
    rememberPassage(usfm, payload);
    return payload;
  });
}

export async function handleYouVersion(req, res, tokenFromEnv) {
  const key = (tokenFromEnv || appKey()).trim();
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

  if (!key) {
    send(200, {
      ok: false,
      hasKey: false,
      error: "YOUVERSION_APP_KEY em falta no .env (portal platform.youversion.com)",
    });
    return;
  }

  try {
    if (action === "resolve" || action === "test") {
      let sample = null;
      if (action === "test") {
        const result = await fetchPassageCached(key, "JHN.3.16");
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
      const payload = await fetchBooksCached(key);
      send(200, {
        ok: true,
        hasKey: true,
        bible: payload.bible,
        usingFallback: false,
        books: payload.books,
      });
      return;
    }

    const usfm = String(url.searchParams.get("usfm") || "JHN.3.16")
      .trim()
      .toUpperCase()
      .replace(/:/g, ".");
    const payload = await fetchPassageCached(key, usfm);
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
  await handleYouVersion(req, res, process.env.YOUVERSION_APP_KEY || process.env.YVP_APP_KEY);
}
