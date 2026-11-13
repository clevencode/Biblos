/**
 * Sets de testamento para filtros de busca.
 * OT/NT = cânon protestante (S21); DC = deuterocanônicos (HAT98 e afins).
 */

import { CANON_BOOKS } from "../youversion/canon";

/** IDs deuterocanônicos / apócrifos comuns no JSON HT1998. */
export const DC_BOOK_IDS = [
  "TOB",
  "JDT",
  "ESG",
  "WIS",
  "SIR",
  "LJE",
  "BAR",
  "DAG",
  "SUS",
  "BEL",
  "1MA",
  "2MA",
] as const;

export const OT_BOOK_SET = new Set(
  CANON_BOOKS.filter((b) => b.testament === "at").map((b) => b.id.toUpperCase()),
);

export const NT_BOOK_SET = new Set(
  CANON_BOOKS.filter((b) => b.testament === "nt").map((b) => b.id.toUpperCase()),
);

export const DC_BOOK_SET = new Set(
  DC_BOOK_IDS.map((id) => id.toUpperCase()),
);

export type SearchTestamentSection = "ot" | "nt" | "dc";

/** Classifica um USFM book id; livros fora OT∪NT∪DC conhecidos → dc. */
export function testamentSectionForBook(
  bookId: string,
): SearchTestamentSection | null {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id) return null;
  if (OT_BOOK_SET.has(id)) return "ot";
  if (NT_BOOK_SET.has(id)) return "nt";
  if (DC_BOOK_SET.has(id)) return "dc";
  // Livro extra da versão (não está no cânon S21) → tratar como DC
  return "dc";
}

export function isOtBook(bookId: string): boolean {
  return testamentSectionForBook(bookId) === "ot";
}

export function isNtBook(bookId: string): boolean {
  return testamentSectionForBook(bookId) === "nt";
}

export function isDcBook(bookId: string): boolean {
  return testamentSectionForBook(bookId) === "dc";
}
