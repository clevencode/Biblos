/** Canon protestant S21 — aligné avec api/youversion.mjs */

export type BibleTestament = "at" | "nt";

export type CanonBook = {
  id: string;
  title: string;
  testament: BibleTestament;
};

export const CANON_BOOKS: CanonBook[] = [
  { id: "GEN", title: "Genèse", testament: "at" },
  { id: "EXO", title: "Exode", testament: "at" },
  { id: "LEV", title: "Lévitique", testament: "at" },
  { id: "NUM", title: "Nombres", testament: "at" },
  { id: "DEU", title: "Deutéronome", testament: "at" },
  { id: "JOS", title: "Josué", testament: "at" },
  { id: "JDG", title: "Juges", testament: "at" },
  { id: "RUT", title: "Ruth", testament: "at" },
  { id: "1SA", title: "1 Samuel", testament: "at" },
  { id: "2SA", title: "2 Samuel", testament: "at" },
  { id: "1KI", title: "1 Rois", testament: "at" },
  { id: "2KI", title: "2 Rois", testament: "at" },
  { id: "1CH", title: "1 Chroniques", testament: "at" },
  { id: "2CH", title: "2 Chroniques", testament: "at" },
  { id: "EZR", title: "Esdras", testament: "at" },
  { id: "NEH", title: "Néhémie", testament: "at" },
  { id: "EST", title: "Esther", testament: "at" },
  { id: "JOB", title: "Job", testament: "at" },
  { id: "PSA", title: "Psaumes", testament: "at" },
  { id: "PRO", title: "Proverbes", testament: "at" },
  { id: "ECC", title: "Ecclésiaste", testament: "at" },
  { id: "SNG", title: "Cantique", testament: "at" },
  { id: "ISA", title: "Ésaïe", testament: "at" },
  { id: "JER", title: "Jérémie", testament: "at" },
  { id: "LAM", title: "Lamentations", testament: "at" },
  { id: "EZK", title: "Ézéchiel", testament: "at" },
  { id: "DAN", title: "Daniel", testament: "at" },
  { id: "HOS", title: "Osée", testament: "at" },
  { id: "JOL", title: "Joël", testament: "at" },
  { id: "AMO", title: "Amos", testament: "at" },
  { id: "OBA", title: "Abdias", testament: "at" },
  { id: "JON", title: "Jonas", testament: "at" },
  { id: "MIC", title: "Michée", testament: "at" },
  { id: "NAM", title: "Nahum", testament: "at" },
  { id: "HAB", title: "Habacuc", testament: "at" },
  { id: "ZEP", title: "Sophonie", testament: "at" },
  { id: "HAG", title: "Aggée", testament: "at" },
  { id: "ZEC", title: "Zacharie", testament: "at" },
  { id: "MAL", title: "Malachie", testament: "at" },
  { id: "MAT", title: "Matthieu", testament: "nt" },
  { id: "MRK", title: "Marc", testament: "nt" },
  { id: "LUK", title: "Luc", testament: "nt" },
  { id: "JHN", title: "Jean", testament: "nt" },
  { id: "ACT", title: "Actes", testament: "nt" },
  { id: "ROM", title: "Romains", testament: "nt" },
  { id: "1CO", title: "1 Corinthiens", testament: "nt" },
  { id: "2CO", title: "2 Corinthiens", testament: "nt" },
  { id: "GAL", title: "Galates", testament: "nt" },
  { id: "EPH", title: "Éphésiens", testament: "nt" },
  { id: "PHP", title: "Philippiens", testament: "nt" },
  { id: "COL", title: "Colossiens", testament: "nt" },
  { id: "1TH", title: "1 Thessaloniciens", testament: "nt" },
  { id: "2TH", title: "2 Thessaloniciens", testament: "nt" },
  { id: "1TI", title: "1 Timothée", testament: "nt" },
  { id: "2TI", title: "2 Timothée", testament: "nt" },
  { id: "TIT", title: "Tite", testament: "nt" },
  { id: "PHM", title: "Philémon", testament: "nt" },
  { id: "HEB", title: "Hébreux", testament: "nt" },
  { id: "JAS", title: "Jacques", testament: "nt" },
  { id: "1PE", title: "1 Pierre", testament: "nt" },
  { id: "2PE", title: "2 Pierre", testament: "nt" },
  { id: "1JN", title: "1 Jean", testament: "nt" },
  { id: "2JN", title: "2 Jean", testament: "nt" },
  { id: "3JN", title: "3 Jean", testament: "nt" },
  { id: "JUD", title: "Jude", testament: "nt" },
  { id: "REV", title: "Apocalypse", testament: "nt" },
];

export const OT_BOOK_IDS = CANON_BOOKS.filter((b) => b.testament === "at").map(
  (b) => b.id,
);
export const NT_BOOK_IDS = CANON_BOOKS.filter((b) => b.testament === "nt").map(
  (b) => b.id,
);

export function bookIdFromUsfm(usfm: string): string {
  return String(usfm || "")
    .trim()
    .toUpperCase()
    .split(".")[0]!;
}

export function booksForSearchScope(
  scope: "all" | "at" | "nt",
  bookId?: string | null,
): string[] | null {
  const id = String(bookId || "")
    .trim()
    .toUpperCase();
  if (id) return [id];
  if (scope === "all") return null;
  if (scope === "at") return OT_BOOK_IDS;
  if (scope === "nt") return NT_BOOK_IDS;
  return null;
}
