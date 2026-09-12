import { toUsfm } from "./youversion/usfm";
import { extractPassageRefs } from "./plan";
import type { PlanDay } from "./types";

export type PlanReadingStep = {
  jour: number;
  /** Libellé barre (ex. Ézéchiel 1:1-28). */
  label: string;
  /** Référence à charger (chapitre). */
  focusRef: string;
  verseStart: number | null;
  verseEnd: number | null;
};

export type PlanReadingReturnTo = "timeline" | "dayNote" | "intro";

export type PlanReadingSession = {
  planId: string;
  /** Jour d’où la lecture a démarré. */
  startJour: number;
  steps: PlanReadingStep[];
  index: number;
  /** Écran d’origine à restaurer sur ←. */
  returnTo: PlanReadingReturnTo;
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

function formatPassageLabel(window: VerseWindow, fallback: string): string {
  const { bookToken, chapter, start, end } = window;
  if (start != null && end != null && start !== end) {
    return `${bookToken} ${chapter}:${start}-${end}`;
  }
  if (start != null) return `${bookToken} ${chapter}:${start}`;
  return `${bookToken} ${chapter}` || fallback;
}

/** Nombre de versets explicitement cités (ex. 3:16 → 1, 3:16-18 → 3). Chapitre seul → 0. */
export function countDefinedVerses(refs: string[]): number {
  let total = 0;
  for (const ref of refs) {
    const window = parseVerseWindow(ref);
    if (!window || window.start == null) continue;
    const end = window.end ?? window.start;
    total += Math.max(1, Math.abs(end - window.start) + 1);
  }
  return total;
}

/**
 * Estimation basée sur les versets définis (pas 5–8 min par chapitre).
 * Chapitre sans verset → ~20 versets (moyenne), pour rester en unité « verset ».
 */
export function formatReadingTimeLabel(refs: string[]): string | null {
  if (!refs.length) return null;
  const defined = countDefinedVerses(refs);
  const verses =
    defined > 0
      ? defined
      : refs.reduce((sum, ref) => (parseVerseWindow(ref) ? sum + 20 : sum), 0);
  if (verses <= 0) return null;
  // Lecture dévotionnelle : ~6–12 versets / min
  const low = Math.max(1, Math.ceil(verses / 12));
  const high = Math.max(low + (verses > 1 && low === 1 ? 1 : 0), Math.ceil(verses / 6));
  return low === high ? `~${low} min` : `~${low}–${high} min`;
}

/** Une étape = un chapitre / passage du jour (pas un verset isolé). */
export function buildChapterStep(jour: number, passage: string): PlanReadingStep | null {
  const trimmed = passage.trim();
  if (!trimmed) return null;
  const window = parseVerseWindow(trimmed);
  if (!window) {
    return {
      jour,
      label: trimmed,
      focusRef: trimmed,
      verseStart: null,
      verseEnd: null,
    };
  }
  const label = formatPassageLabel(window, trimmed);
  const focusRef =
    window.start != null && window.end != null && window.start !== window.end
      ? `${window.bookToken} ${window.chapter}:${window.start}-${window.end}`
      : window.start != null
        ? `${window.bookToken} ${window.chapter}:${window.start}`
        : `${window.bookToken} ${window.chapter}`;
  return {
    jour,
    label,
    focusRef,
    verseStart: window.start,
    verseEnd: window.end ?? window.start,
  };
}

/**
 * Session de lecture plan : uniquement les chapitres du jour courant.
 * › = prochain chapitre du même jour ; s’il n’y en a plus → ✓ conclure.
 * Ne passe jamais au jour suivant.
 */
export function createPlanReadingSession(input: {
  planId: string;
  startJour: number;
  days: PlanDay[];
  returnTo?: PlanReadingReturnTo;
}): PlanReadingSession | null {
  const dayEntries = (input.days ?? []).filter((day) => day.jour === input.startJour);
  if (!dayEntries.length) return null;

  const steps: PlanReadingStep[] = [];
  const seen = new Set<string>();

  for (const day of dayEntries) {
    const raw = String(`${day.texte || ""}\n${day.defi || ""}`).trim();
    if (!raw) continue;
    const refs = extractPassageRefs(raw);
    const passages = refs.length ? refs : [raw];
    for (const passage of passages) {
      const step = buildChapterStep(day.jour, passage);
      if (!step) continue;
      const key = step.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      steps.push(step);
    }
  }

  if (!steps.length) return null;
  return {
    planId: input.planId,
    startJour: input.startJour,
    steps,
    index: 0,
    returnTo: input.returnTo ?? "timeline",
  };
}

/** True si le verset fait partie de la plage du chapitre courant. */
export function verseInPlanRange(
  verse: number,
  step: PlanReadingStep | null | undefined,
): boolean {
  if (!step) return false;
  if (step.verseStart == null || step.verseEnd == null) return true;
  const a = Math.min(step.verseStart, step.verseEnd);
  const b = Math.max(step.verseStart, step.verseEnd);
  return verse >= a && verse <= b;
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
