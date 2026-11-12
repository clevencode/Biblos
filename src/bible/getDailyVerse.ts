/**
 * Verset du jour — déterministe, 100% offline (IndexedDB / mémoire locale).
 */

import { offlinePassage } from "../bibleOffline";
import { ht1998Passage } from "./ht1998";
import {
  bibleVersionDef,
  readBibleTextVersionPref,
  type BibleTextVersionId,
} from "./bibleVersions";

/** Références USFM curatées (inspirantes) — ~80 entrées. */
export const DAILY_VERSE_USFM: readonly string[] = [
  "JHN.3.16",
  "PSA.23.1",
  "PHP.4.13",
  "ROM.8.28",
  "JOS.1.9",
  "ISA.41.10",
  "MAT.11.28",
  "PSA.46.1",
  "PRO.3.5",
  "JER.29.11",
  "PSA.119.105",
  "2CO.5.17",
  "GAL.2.20",
  "EPH.2.8",
  "PSA.27.1",
  "ISA.40.31",
  "MAT.6.33",
  "JHN.14.6",
  "ROM.12.2",
  "PSA.37.4",
  "1PE.5.7",
  "HEB.11.1",
  "JHN.15.5",
  "PSA.91.1",
  "MIC.6.8",
  "COL.3.23",
  "1TH.5.16",
  "PSA.34.8",
  "ISA.26.3",
  "MAT.5.16",
  "JHN.8.12",
  "ROM.5.8",
  "PSA.139.14",
  "PHP.4.6",
  "2TI.1.7",
  "PSA.121.1",
  "ISA.53.5",
  "MAT.28.19",
  "JHN.1.12",
  "ACT.1.8",
  "ROM.8.1",
  "PSA.19.1",
  "PRO.16.3",
  "LAM.3.22",
  "MAT.22.37",
  "JHN.10.10",
  "1CO.13.4",
  "PSA.100.1",
  "ISA.55.8",
  "ZEC.4.6",
  "MAT.7.7",
  "JHN.16.33",
  "ROM.15.13",
  "PSA.51.10",
  "PRO.18.10",
  "ISA.43.2",
  "HAB.3.19",
  "MAT.5.9",
  "LUK.6.31",
  "JHN.13.34",
  "ROM.10.9",
  "PSA.62.1",
  "ECC.3.1",
  "ISA.9.6",
  "MAT.4.4",
  "MRK.12.30",
  "LUK.12.32",
  "JHN.11.25",
  "ACT.16.31",
  "2CO.12.9",
  "GAL.5.22",
  "EPH.6.10",
  "PHP.1.6",
  "COL.1.17",
  "1TI.4.12",
  "HEB.12.1",
  "JAS.1.5",
  "1JN.4.7",
  "REV.21.4",
  "PSA.1.1",
];

/** Fallback FR si la Bible locale n’est pas encore téléchargée. */
const EMBEDDED_FALLBACK: Record<string, string> = {
  "JHN.3.16":
    "Car Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse pas, mais qu’il ait la vie éternelle.",
  "PSA.23.1": "L’Éternel est mon berger : je ne manquerai de rien.",
  "PHP.4.13": "Je peux tout par celui qui me fortifie.",
  "ROM.8.28":
    "Nous savons, du reste, que toutes choses travaillent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein.",
  "JOS.1.9":
    "Ne t’ai-je pas donné cet ordre : Fortifie-toi et prends courage ? Ne t’épouvante pas et ne t’effraie pas, car l’Éternel, ton Dieu, est avec toi partout où tu iras.",
};

export type DailyVerse = {
  usfm: string;
  refLabel: string;
  text: string;
  versionId: BibleTextVersionId;
  versionTitle: string;
  fromLocalBible: boolean;
};

export function dayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function dailyVerseUsfmForDate(date = new Date()): string {
  const list = DAILY_VERSE_USFM;
  const idx = dayOfYear(date) % list.length;
  return list[idx]!;
}

function usfmToOpenRef(usfm: string): string {
  return usfm.replace(/\./g, " ");
}

function humanizeUsfm(usfm: string): string {
  const [book, chapter, verse] = usfm.split(".");
  if (!book || !chapter) return usfm;
  return verse ? `${book} ${chapter}.${verse}` : `${book} ${chapter}`;
}

/**
 * Charge le verset du jour depuis S21 / HT98 local.
 * Ne dépend pas du réseau.
 */
export async function getDailyVerse(
  date = new Date(),
  versionId: BibleTextVersionId = readBibleTextVersionPref(),
): Promise<DailyVerse> {
  const usfm = dailyVerseUsfmForDate(date);
  const def = bibleVersionDef(versionId);

  try {
    const result =
      versionId === "ht98"
        ? await ht1998Passage(usfm)
        : await offlinePassage(usfm);
    if (result.ok && result.passage?.content?.trim()) {
      return {
        usfm,
        refLabel: result.passage.reference || humanizeUsfm(usfm),
        text: result.passage.content.trim(),
        versionId,
        versionTitle: def.title,
        fromLocalBible: true,
      };
    }
  } catch {
    /* fallback */
  }

  // Essayer l’autre version locale si la préférée échoue
  if (versionId === "ht98") {
    try {
      const s21 = await offlinePassage(usfm);
      if (s21.ok && s21.passage?.content?.trim()) {
        const s21Def = bibleVersionDef("s21");
        return {
          usfm,
          refLabel: s21.passage.reference || humanizeUsfm(usfm),
          text: s21.passage.content.trim(),
          versionId: "s21",
          versionTitle: s21Def.title,
          fromLocalBible: true,
        };
      }
    } catch {
      /* ignore */
    }
  }

  const embedded = EMBEDDED_FALLBACK[usfm];
  return {
    usfm,
    refLabel: humanizeUsfm(usfm),
    text:
      embedded ??
      "Téléchargez Segond 21 dans Profil → Stockage pour lire le verset du jour hors ligne.",
    versionId,
    versionTitle: def.title,
    fromLocalBible: false,
  };
}

export function dailyVerseOpenRef(usfm: string): string {
  return usfmToOpenRef(usfm);
}
