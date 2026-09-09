/** Converte referência humana → USFM (ex. Jean 3.16 → JHN.3.16). Port Flashbible. */

/** Clés sans accents (foldBookKey). */
const BOOKS: Record<string, string> = {
  genesis: "GEN",
  genese: "GEN",
  exodus: "EXO",
  exode: "EXO",
  leviticus: "LEV",
  levitique: "LEV",
  numbers: "NUM",
  nombres: "NUM",
  deuteronomy: "DEU",
  deuteronome: "DEU",
  joshua: "JOS",
  josue: "JOS",
  judges: "JDG",
  juges: "JDG",
  ruth: "RUT",
  "1 samuel": "1SA",
  "2 samuel": "2SA",
  "1 kings": "1KI",
  "1 rois": "1KI",
  "2 kings": "2KI",
  "2 rois": "2KI",
  "1 chronicles": "1CH",
  "1 chroniques": "1CH",
  "2 chronicles": "2CH",
  "2 chroniques": "2CH",
  ezra: "EZR",
  esdras: "EZR",
  nehemiah: "NEH",
  nehemie: "NEH",
  esther: "EST",
  job: "JOB",
  psalm: "PSA",
  psaumes: "PSA",
  psaume: "PSA",
  proverbs: "PRO",
  proverbes: "PRO",
  ecclesiastes: "ECC",
  ecclesiaste: "ECC",
  "song of solomon": "SNG",
  "cantique des cantiques": "SNG",
  cantiques: "SNG",
  isaiah: "ISA",
  esaie: "ISA",
  jeremiah: "JER",
  jeremie: "JER",
  lamentations: "LAM",
  ezekiel: "EZK",
  ezechiel: "EZK",
  daniel: "DAN",
  hosea: "HOS",
  osee: "HOS",
  joel: "JOL",
  amos: "AMO",
  obadiah: "OBA",
  abdias: "OBA",
  jonah: "JON",
  jonas: "JON",
  micah: "MIC",
  michee: "MIC",
  nahum: "NAM",
  habakkuk: "HAB",
  habacuc: "HAB",
  zephaniah: "ZEP",
  sophonie: "ZEP",
  haggai: "HAG",
  aggee: "HAG",
  zechariah: "ZEC",
  zacharie: "ZEC",
  malachi: "MAL",
  malachie: "MAL",
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
  galatians: "GAL",
  galates: "GAL",
  ephesians: "EPH",
  ephesiens: "EPH",
  philippians: "PHP",
  philippiens: "PHP",
  colossians: "COL",
  colossiens: "COL",
  "1 thessalonians": "1TH",
  "1 thessaloniciens": "1TH",
  "2 thessalonians": "2TH",
  "2 thessaloniciens": "2TH",
  "1 timothy": "1TI",
  "1 timothee": "1TI",
  "2 timothy": "2TI",
  "2 timothee": "2TI",
  titus: "TIT",
  tite: "TIT",
  philemon: "PHM",
  hebrews: "HEB",
  hebreux: "HEB",
  james: "JAS",
  jacques: "JAS",
  "1 peter": "1PE",
  "1 pierre": "1PE",
  "2 peter": "2PE",
  "2 pierre": "2PE",
  "1 john": "1JN",
  "1 jean": "1JN",
  "2 john": "2JN",
  "2 jean": "2JN",
  "3 john": "3JN",
  "3 jean": "3JN",
  jude: "JUD",
  revelation: "REV",
  apocalypse: "REV",
  exod: "EXO",
  deut: "DEU",
  josh: "JOS",
  judg: "JDG",
  "1sam": "1SA",
  "2sam": "2SA",
  "1kgs": "1KI",
  "2kgs": "2KI",
  "1chr": "1CH",
  "2chr": "2CH",
  esth: "EST",
  ps: "PSA",
  prov: "PRO",
  eccl: "ECC",
  song: "SNG",
  isa: "ISA",
  jer: "JER",
  ezek: "EZK",
  "1thess": "1TH",
  "2thess": "2TH",
  "1tim": "1TI",
  "2tim": "2TI",
  phlm: "PHM",
  jas: "JAS",
  "1pet": "1PE",
  "2pet": "2PE",
  "1john": "1JN",
  "2john": "2JN",
  "3john": "3JN",
  matt: "MAT",
};

/** Normalise le nom de livre pour lookup (accents → ASCII). */
export function foldBookKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUsfm(usfm: string): string {
  return usfm.trim().toUpperCase().replace(/:/g, ".");
}

/** Code USFM si livre connu, sinon null (évite « Jour » → JOU). */
export function knownBookCode(name: string): string | null {
  return BOOKS[foldBookKey(name)] ?? null;
}

function bookCode(name: string): string {
  return knownBookCode(name) ?? name.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "");
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

/** Lecteur public LSG (midvash / bible-data). */
export function bibleComUrl(_usfm?: string, _bibleId?: number): string {
  return "https://midvash.com/lsg";
}

/** True se o texto é uma referência de passagem com livro bíblico conhecido. */
export function isPassageRef(text: string): boolean {
  const cleaned = text.replace(/\.+$/, "").trim();
  if (!cleaned || cleaned.length > 80) return false;
  if (/^(jour|day|objectif|defi|défi|texte|question|semaine)\b/i.test(cleaned)) {
    return false;
  }
  if (/^[A-Z0-9]{2,3}\.\d+/i.test(cleaned)) return true;

  const withVerse = cleaned.match(
    /^((?:[123]\s+)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*){0,3})\s+\d+([.:]\d+)?(?:\s*[-–—]\s*\d+([.:]\d+)?)?$/u,
  );
  if (!withVerse) return false;
  const code = knownBookCode(withVerse[1]!.trim());
  if (!code) return false;
  const usfm = toUsfm(cleaned);
  return /^[A-Z0-9]{2,3}\.\d+/i.test(usfm);
}
