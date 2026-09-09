import { toUsfm } from "./youversion/usfm";

export type PlanReadingStep = {
  /** Libellé barre (ex. Ésaïe 6:3). */
  label: string;
  /** Référence à charger dans le lecteur. */
  focusRef: string;
  verse: number;
};

export type PlanReadingSession = {
  planId: string;
  jour: number;
  /** Passage d’origine du jour (ex. Ésaïe 6:1-8). */
  passage: string;
  steps: PlanReadingStep[];
  index: number;
};

type VerseWindow = {
  bookToken: string;
  chapter: string;
  start: number | null;
  end: number | null;
};

/** Extrait livre + chapitre + fenêtre de versets depuis une référence humaine / USFM. */
export function parseVerseWindow(passage: string): VerseWindow | null {
  const raw = String(passage || "").trim();
  if (!raw) return null;

  const human = raw.match(
    /^((?:[123]\s+)?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\-]*){0,3})\s+(\d+)(?:[.:](\d+)(?:\s*[-–—]\s*(\d+))?)?$/u,
  );
  if (human) {
    return {
      bookToken: human[1]!.trim(),
      chapter: human[2]!,
      start: human[3] ? Number(human[3]) : null,
      end: human[4] ? Number(human[4]) : human[3] ? Number(human[3]) : null,
    };
  }

  const usfm = toUsfm(raw);
  const usfmMatch = usfm.match(/^([A-Z0-9]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/i);
  if (!usfmMatch) return null;
  return {
    bookToken: usfmMatch[1]!.toUpperCase(),
    chapter: usfmMatch[2]!,
    start: usfmMatch[3] ? Number(usfmMatch[3]) : null,
    end: usfmMatch[4] ? Number(usfmMatch[4]) : usfmMatch[3] ? Number(usfmMatch[3]) : null,
  };
}

function verseList(start: number, end: number): number[] {
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  const out: number[] = [];
  for (let v = a; v <= b; v += 1) out.push(v);
  return out;
}

function makeStep(bookToken: string, chapter: string, verse: number): PlanReadingStep {
  return {
    label: `${bookToken} ${chapter}:${verse}`,
    focusRef: `${bookToken} ${chapter}:${verse}`,
    verse,
  };
}

/** Construit les étapes verset-par-verset pour le jour du plan. */
export function buildPlanReadingSteps(
  passage: string,
  availableVerses?: number[] | null,
): PlanReadingStep[] {
  const window = parseVerseWindow(passage);
  if (!window) return [];

  const { bookToken, chapter, start, end } = window;
  if (start != null && end != null) {
    return verseList(start, end).map((verse) => makeStep(bookToken, chapter, verse));
  }

  if (availableVerses?.length) {
    return availableVerses.map((verse) => makeStep(bookToken, chapter, verse));
  }

  // Chapitre entier pas encore chargé — une étape provisoire sur le chapitre.
  return [
    {
      label: `${bookToken} ${chapter}`,
      focusRef: `${bookToken} ${chapter}`,
      verse: 0,
    },
  ];
}

export function createPlanReadingSession(input: {
  planId: string;
  jour: number;
  passage: string;
  availableVerses?: number[] | null;
}): PlanReadingSession | null {
  const steps = buildPlanReadingSteps(input.passage, input.availableVerses);
  if (!steps.length) return null;
  return {
    planId: input.planId,
    jour: input.jour,
    passage: input.passage.trim(),
    steps,
    index: 0,
  };
}

/** Enrichit une session chapitre-seul avec la liste réelle des versets chargés. */
export function expandPlanReadingWithVerses(
  session: PlanReadingSession,
  verses: number[],
): PlanReadingSession {
  if (!verses.length) return session;
  const window = parseVerseWindow(session.passage);
  if (!window) return session;
  // Déjà une plage explicite (ex. 6:1-8) — ne pas remplacer.
  if (window.start != null && window.end != null) return session;
  // Déjà expansé.
  if (session.steps.length > 1) return session;
  const onlyChapterPlaceholder = session.steps.length === 1 && session.steps[0]!.verse === 0;
  if (!onlyChapterPlaceholder) return session;

  const steps = buildPlanReadingSteps(session.passage, verses);
  if (!steps.length) return session;
  return { ...session, steps, index: 0 };
}

export function currentPlanStep(session: PlanReadingSession): PlanReadingStep | null {
  return session.steps[session.index] ?? null;
}

export function isLastPlanStep(session: PlanReadingSession): boolean {
  return session.index >= session.steps.length - 1;
}

export function isFirstPlanStep(session: PlanReadingSession): boolean {
  return session.index <= 0;
}
