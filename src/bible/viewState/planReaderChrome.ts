import { parseUsfmParts } from "../../youversion/client";

/** Utilisateur sur le chapitre du pas actif du plan (sinon « hors pas »). */
export function planReaderOnStep(input: {
  planFocusRef: string;
  planLabel: string;
  bookId: string;
  chapterId: string;
}): boolean {
  const parts = parseUsfmParts(input.planFocusRef || input.planLabel);
  return (
    parts.bookId.toUpperCase() === input.bookId.toUpperCase() &&
    String(parts.chapterId) === String(input.chapterId)
  );
}

export function planStepProgressLabel(
  stepIndex: number,
  stepCount: number,
): string | null {
  if (stepCount <= 1) return null;
  return `${stepIndex + 1}/${stepCount}`;
}
