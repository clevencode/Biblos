/**
 * Catálogo bíblico offline-first — fonte única para UI (sem lista vazia).
 */
import { buildS21BookList, S21_BIBLE_META } from "../bibleS21Canon";
import { getOfflineMeta } from "../bibleOffline";
import { CANON_BOOKS } from "../youversion/canon";
import {
  fetchBooks,
  LSG_BIBLE_ID,
  type YouVersionBible,
  type YouVersionBook,
} from "../youversion/client";

export const BIBLE_READER_PREFS_KEY = "biblos-bible-reader";
export const BIBLE_BOOKS_CACHE_KEY = "biblos-bible-books-s21";
const BOOKS_CACHE_TTL_MS = 7 * 86_400_000;

export type BibleReadingPrefs = {
  bookId?: string;
  chapterId?: string;
  fontSize?: number;
  textVersion?: "s21" | "ht98";
};

export type CatalogSource = "seed" | "cache" | "idb" | "network";

export type CatalogHydration = {
  books: YouVersionBook[];
  bible: YouVersionBible;
  source: CatalogSource;
};

let seedBookById: Map<string, YouVersionBook> | null = null;

function seedBookMap(): Map<string, YouVersionBook> {
  if (!seedBookById) {
    seedBookById = new Map(
      buildS21BookList().map((book) => [book.id.toUpperCase(), book]),
    );
  }
  return seedBookById;
}

export function getSeedCatalog(): CatalogHydration {
  return {
    books: buildS21BookList(),
    bible: { ...S21_BIBLE_META },
    source: "seed",
  };
}

export function readBooksCache(): { bible: YouVersionBible; books: YouVersionBook[] } | null {
  try {
    const raw = localStorage.getItem(BIBLE_BOOKS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      bible?: YouVersionBible;
      books?: YouVersionBook[];
      at?: number;
    };
    if (!parsed?.books?.length) return null;
    if (parsed.at && Date.now() - parsed.at > BOOKS_CACHE_TTL_MS) return null;
    return {
      bible:
        parsed.bible ?? {
          id: LSG_BIBLE_ID,
          abbreviation: "S21",
          title: "Segond 21",
          languageCode: "fr",
        },
      books: parsed.books,
    };
  } catch {
    return null;
  }
}

export function writeBooksCache(bible: YouVersionBible | null, books: YouVersionBook[]) {
  if (!books.length) return;
  try {
    localStorage.setItem(
      BIBLE_BOOKS_CACHE_KEY,
      JSON.stringify({
        at: Date.now(),
        bible:
          bible ?? {
            id: LSG_BIBLE_ID,
            abbreviation: "S21",
            title: "Segond 21",
            languageCode: "fr",
          },
        books,
      }),
    );
  } catch {
    /* private mode */
  }
}

export function readReadingPrefs(): BibleReadingPrefs {
  try {
    const raw = localStorage.getItem(BIBLE_READER_PREFS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BibleReadingPrefs;
  } catch {
    return {};
  }
}

export function readBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function resolveBookDisplay(
  bookId: string,
  books?: YouVersionBook[] | null,
): string {
  const key = String(bookId || "")
    .trim()
    .toUpperCase();
  if (!key) return "Genèse";

  const fromList = books?.find((b) => b.id.toUpperCase() === key);
  if (fromList?.title?.trim()) return fromList.title.trim();

  const fromSeed = seedBookMap().get(key);
  if (fromSeed?.title?.trim()) return fromSeed.title.trim();

  const fromCanon = CANON_BOOKS.find((b) => b.id.toUpperCase() === key);
  if (fromCanon?.title?.trim()) return fromCanon.title.trim();

  return key;
}

function sourceRank(source: CatalogSource): number {
  switch (source) {
    case "seed":
      return 0;
    case "cache":
      return 1;
    case "idb":
      return 2;
    case "network":
      return 3;
    default:
      return 0;
  }
}

function pickBetter(a: CatalogHydration, b: CatalogHydration): CatalogHydration {
  return sourceRank(b.source) > sourceRank(a.source) ? b : a;
}

/** Estado síncrono no primeiro frame (seed ou cache local). */
export function getSyncCatalog(): CatalogHydration {
  const cached = readBooksCache();
  if (cached?.books?.length) {
    return { books: cached.books, bible: cached.bible, source: "cache" };
  }
  return getSeedCatalog();
}

function catalogFromFetch(result: Awaited<ReturnType<typeof fetchBooks>>): CatalogHydration | null {
  if (!result.books?.length) return null;
  const bible =
    result.bible ??
    ({
      id: LSG_BIBLE_ID,
      abbreviation: "S21",
      title: "Segond 21",
      languageCode: "fr",
    } satisfies YouVersionBible);

  let source: CatalogSource = "network";
  if (result.usingFallback) {
    if (result.fallbackReason === "seed") source = "seed";
    else if (result.fallbackReason === "offline") source = "idb";
    else source = "cache";
  }

  return { books: result.books, bible, source };
}

/** Hidratação completa; nunca devolve lista vazia. */
export async function hydrateCatalog(): Promise<CatalogHydration> {
  let best = getSyncCatalog();

  try {
    const meta = await getOfflineMeta();
    if (meta?.books?.length) {
      best = pickBetter(best, {
        books: meta.books,
        bible: {
          id: LSG_BIBLE_ID,
          abbreviation: "S21",
          title: "Segond 21",
          languageCode: "fr",
        },
        source: "idb",
      });
    }
  } catch {
    /* IndexedDB indisponível */
  }

  try {
    const result = await fetchBooks();
    const fromNet = catalogFromFetch(result);
    if (fromNet) {
      if (result.ok && fromNet.source === "network") {
        writeBooksCache(fromNet.bible, fromNet.books);
      }
      best = pickBetter(best, fromNet);
    }
  } catch {
    /* rede */
  }

  if (!best.books.length) return getSeedCatalog();
  return best;
}
