/** Converte referência humana → USFM (ex. Jean 3.16 → JHN.3.16). Port Flashbible. */

const BOOKS: Record<string, string> = {
  genesis: "GEN",
  genèse: "GEN",
  genese: "GEN",
  exodus: "EXO",
  exode: "EXO",
  matthew: "MAT",
  matthieu: "MAT",
  mark: "MRK",
  marc: "MRK",
  luke: "LUK",
  luc: "LUK",
  john: "JHN",
  jean: "JHN",
  acts: "ACT",
  actes: "ACT",
  romans: "ROM",
  romains: "ROM",
  "1 corinthians": "1CO",
  "1 corinthiens": "1CO",
  "2 corinthians": "2CO",
  "2 corinthiens": "2CO",
  ephesians: "EPH",
  éphésiens: "EPH",
  ephesiens: "EPH",
  philippians: "PHP",
  philippiens: "PHP",
  colossians: "COL",
  colossiens: "COL",
  hebrews: "HEB",
  hébreux: "HEB",
  hebreux: "HEB",
  james: "JAS",
  jacques: "JAS",
  "1 peter": "1PE",
  "1 pierre": "1PE",
  "2 peter": "2PE",
  "2 pierre": "2PE",
  revelation: "REV",
  apocalypse: "REV",
  psalm: "PSA",
  psaumes: "PSA",
  psaume: "PSA",
  isaiah: "ISA",
  esaïe: "ISA",
  esaie: "ISA",
};

export function normalizeUsfm(usfm: string): string {
  return usfm.trim().toUpperCase().replace(/:/g, ".");
}

function bookCode(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  return BOOKS[key] ?? name.slice(0, 3).toUpperCase();
}

export function toUsfm(reference: string): string {
  const trimmed = reference.trim();
  if (/^[A-Z0-9]{2,3}\.\d+/i.test(trimmed)) {
    return normalizeUsfm(trimmed);
  }

  const match = trimmed.match(
    /^([\d]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+)[:.](\d+)(?:\s*[-–]\s*(\d+))?/u,
  );
  if (!match) {
    // Chapitre seul : "Jean 3" / "JHN 3"
    const chapterOnly = trimmed.match(/^([\d]?\s*[A-Za-zÀ-ÿ]+)\s+(\d+)$/u);
    if (chapterOnly) {
      return `${bookCode(chapterOnly[1]!.trim())}.${chapterOnly[2]}`;
    }
    return normalizeUsfm(trimmed);
  }

  const book = bookCode(match[1]!.trim());
  const chapter = match[2]!;
  const verse = match[3]!;
  const end = match[4];
  if (end) return `${book}.${chapter}.${verse}-${end}`;
  return `${book}.${chapter}.${verse}`;
}

export function bibleComUrl(usfm: string, bibleId: number): string {
  return `https://www.bible.com/bible/${bibleId}/${toUsfm(usfm)}`;
}

/** True se o texto parece uma referência de passagem (ex. Jean 3.16 / JHN.3). */
export function isPassageRef(text: string): boolean {
  const cleaned = text.replace(/\.+$/, "").trim();
  if (!cleaned) return false;
  const usfm = toUsfm(cleaned);
  return /^[A-Z0-9]{2,3}\.\d+/i.test(usfm);
}

/** Nom du flashcard VERSECARD : JEAN 3.16 */
export function formatVerseCardFront(bookTitle: string, chapter: string | number, verse: number): string {
  const book = String(bookTitle || "")
    .trim()
    .toUpperCase();
  return `${book} ${chapter}.${verse}`;
}

