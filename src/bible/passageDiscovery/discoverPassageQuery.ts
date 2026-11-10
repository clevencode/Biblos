import { CANON_BOOKS } from "../../youversion/canon";
import type { YouVersionBook } from "../../youversion/client";
import { passageJumpsFromQuery } from "../../youversion/bibleRefs";
import type { ParsedPassage } from "../../youversion/usfm";
import { normalizeQuery } from "./normalizeQuery";
import type {
  DiscoveryBookHit,
  DiscoveryJump,
  PassageDiscoveryResult,
  PassageDiscoverySections,
} from "./types";

const CANON_ORDER = new Map(CANON_BOOKS.map((book, index) => [book.id, index]));
const CANON_BY_ID = new Map(CANON_BOOKS.map((book) => [book.id, book]));

function bookTitleFromId(bookId: string): string {
  return CANON_BY_ID.get(bookId.toUpperCase())?.title ?? bookId;
}

function jumpLabel(jump: ParsedPassage): string {
  const title = bookTitleFromId(jump.bookId);
  if (jump.verse == null) return `${title} ${jump.chapter}`;
  if (jump.verseEnd != null && jump.verseEnd !== jump.verse) {
    return `${title} ${jump.chapter}.${jump.verse}-${jump.verseEnd}`;
  }
  return `${title} ${jump.chapter}.${jump.verse}`;
}

function testamentForBookId(bookId: string): DiscoveryBookHit["testament"] {
  return CANON_BY_ID.get(bookId.toUpperCase())?.testament ?? "at";
}

function sortByCanon(hits: DiscoveryBookHit[]): DiscoveryBookHit[] {
  return [...hits].sort(
    (a, b) => (CANON_ORDER.get(a.id) ?? 999) - (CANON_ORDER.get(b.id) ?? 999),
  );
}

function groupByTestament(hits: DiscoveryBookHit[]): PassageDiscoverySections {
  const at: DiscoveryBookHit[] = [];
  const nt: DiscoveryBookHit[] = [];
  for (const hit of sortByCanon(hits)) {
    if (hit.testament === "nt") nt.push(hit);
    else at.push(hit);
  }
  return { at, nt };
}

function catalogHit(book: YouVersionBook, reason: DiscoveryBookHit["reason"], count?: number): DiscoveryBookHit {
  const id = String(book.id || "").toUpperCase();
  const canon = CANON_BY_ID.get(id);
  return {
    id,
    title: String(book.title || canon?.title || id),
    testament: canon?.testament ?? testamentForBookId(id),
    reason,
    count: count && count > 0 ? count : undefined,
  };
}

export function matchBooksByTitle(query: string, books: YouVersionBook[]): DiscoveryBookHit[] {
  const q = normalizeQuery(query);
  if (!q) return books.map((book) => catalogHit(book, "title"));
  return books
    .filter((book) => {
      const title = normalizeQuery(book.title || "");
      const id = normalizeQuery(book.id || "");
      return title.includes(q) || id.includes(q);
    })
    .map((book) => catalogHit(book, "title"));
}

export function booksFromContentCounts(
  bookCounts: Record<string, number>,
  books: YouVersionBook[],
): DiscoveryBookHit[] {
  const titleById = new Map(
    books.map((b) => [String(b.id).toUpperCase(), b] as const),
  );
  const hits: DiscoveryBookHit[] = [];
  for (const [rawId, count] of Object.entries(bookCounts)) {
    const id = String(rawId || "").toUpperCase();
    if (!id || !Number.isFinite(count) || count <= 0) continue;
    const book = titleById.get(id);
    const canon = CANON_BY_ID.get(id);
    if (!book && !canon) continue;
    hits.push({
      id,
      title: book?.title ?? canon?.title ?? id,
      testament: canon?.testament ?? testamentForBookId(id),
      reason: "content",
      count,
    });
  }
  return hits.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || (CANON_ORDER.get(a.id) ?? 999) - (CANON_ORDER.get(b.id) ?? 999));
}

export function mergeBookHits(
  titleHits: DiscoveryBookHit[],
  contentHits: DiscoveryBookHit[],
): DiscoveryBookHit[] {
  const merged = new Map<string, DiscoveryBookHit>();
  for (const hit of titleHits) {
    merged.set(hit.id, { ...hit });
  }
  for (const hit of contentHits) {
    const prev = merged.get(hit.id);
    if (!prev) {
      merged.set(hit.id, { ...hit });
      continue;
    }
    merged.set(hit.id, {
      ...prev,
      reason: "title",
      count: hit.count ?? prev.count,
    });
  }
  return sortByCanon([...merged.values()]);
}

export function buildDiscoveryJumps(query: string): DiscoveryJump[] {
  return passageJumpsFromQuery(query).map((passage) => ({
    passage,
    label: jumpLabel(passage),
  }));
}

export function emptyDiscoveryResult(query = ""): PassageDiscoveryResult {
  return { query, jumps: [], sections: { at: [], nt: [] }, contentError: null };
}

export function allBooksGrouped(books: YouVersionBook[]): PassageDiscoveryResult {
  const hits = matchBooksByTitle("", books);
  return {
    query: "",
    jumps: [],
    sections: groupByTestament(hits),
    contentError: null,
  };
}

export function buildPassageDiscoveryResult(
  query: string,
  books: YouVersionBook[],
  options?: {
    bookCounts?: Record<string, number> | null;
    contentError?: string | null;
    /** Só hits de conteúdo (painel palavras) — sem catálogo AT/NT nem saltos de referência. */
    contentOnly?: boolean;
  },
): PassageDiscoveryResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return options?.contentOnly ? emptyDiscoveryResult("") : allBooksGrouped(books);
  }

  if (options?.contentOnly) {
    const contentHits = options.bookCounts
      ? booksFromContentCounts(options.bookCounts, books)
      : [];
    return {
      query: trimmed,
      jumps: [],
      sections: groupByTestament(contentHits),
      contentError: options.contentError ?? null,
    };
  }

  const jumps = buildDiscoveryJumps(trimmed);
  if (jumps.length > 0) {
    return { query: trimmed, jumps, sections: { at: [], nt: [] }, contentError: null };
  }

  const titleHits = matchBooksByTitle(trimmed, books);
  const contentHits = options?.bookCounts
    ? booksFromContentCounts(options.bookCounts, books)
    : [];
  const merged = mergeBookHits(titleHits, contentHits);

  return {
    query: trimmed,
    jumps: [],
    sections: groupByTestament(merged),
    contentError: options?.contentError ?? null,
  };
}

/** Resultado imediato (título + referências) antes da pesquisa por conteúdo. */
export function discoverPassageSync(query: string, books: YouVersionBook[]): PassageDiscoveryResult {
  return buildPassageDiscoveryResult(query, books, { bookCounts: null, contentError: null });
}

export function hasDiscoveryBooks(result: PassageDiscoveryResult): boolean {
  return result.sections.at.length > 0 || result.sections.nt.length > 0;
}
