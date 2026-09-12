import { todayKey } from "./calendar";

export type VerseOfDay = {
  reference: string;
  /** Texte court de secours si le chargement échoue. */
  fallback: string;
};

/** Sélection FR (Segond 21) — un verset par jour calendaire. */
const VERSES: VerseOfDay[] = [
  {
    reference: "Jean 3.16",
    fallback:
      "Car Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse pas mais ait la vie éternelle.",
  },
  {
    reference: "Psaumes 23.1",
    fallback: "L’Éternel est mon berger : je ne manquerai de rien.",
  },
  {
    reference: "Philippiens 4.13",
    fallback: "Je peux tout par celui qui me fortifie.",
  },
  {
    reference: "Proverbes 3.5",
    fallback:
      "Confie-toi en l’Éternel de tout ton cœur, et ne t’appuie pas sur ta sagesse.",
  },
  {
    reference: "Ésaïe 41.10",
    fallback:
      "N’aie pas peur, car je suis moi-même avec toi ; ne promène pas des regards inquiets, car je suis ton Dieu.",
  },
  {
    reference: "Matthieu 11.28",
    fallback:
      "Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.",
  },
  {
    reference: "Romains 8.28",
    fallback:
      "Nous savons, du reste, que toutes choses travaillent ensemble pour le bien de ceux qui aiment Dieu.",
  },
  {
    reference: "Josué 1.9",
    fallback:
      "N’ai-je pas donné l’ordre ? Fortifie-toi et prends courage ! Ne sois pas effrayé ni épouvanté, car l’Éternel, ton Dieu, est avec toi partout où tu iras.",
  },
  {
    reference: "Psaumes 46.2",
    fallback: "Dieu est pour nous un refuge et un appui, un secours toujours présent dans la détresse.",
  },
  {
    reference: "2 Timothée 1.7",
    fallback:
      "Car ce n’est pas un esprit de timidité que Dieu nous a donné, mais un esprit de force, d’amour et de sagesse.",
  },
  {
    reference: "Hébreux 11.1",
    fallback:
      "Or la foi, c’est la ferme assurance des choses qu’on espère, la démonstration de celles qu’on ne voit pas.",
  },
  {
    reference: "1 Jean 4.8",
    fallback: "Celui qui n’aime pas n’a pas connu Dieu, car Dieu est amour.",
  },
];

function dayIndex(dateKey = todayKey()): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = Date.UTC(y, 0, 0);
  const now = Date.UTC(y, m - 1, d);
  const dayOfYear = Math.floor((now - start) / 86_400_000);
  return Math.max(0, dayOfYear - 1) % VERSES.length;
}

export function getVerseOfDay(dateKey = todayKey()): VerseOfDay {
  return VERSES[dayIndex(dateKey)]!;
}
