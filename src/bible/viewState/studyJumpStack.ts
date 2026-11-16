import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Superfície a reabrir no Retourner.
 * `refs` = Options → Référence; restantes = sheet de origem do clique.
 */
export type StudyJumpReturnTo =
  | "refs"
  | "history"
  | "marks"
  | "word_search";

/** Passo empilhado antes de Aller au verset / chapitre. */
export type StudyJumpStep = {
  bookId: string;
  chapterId: string;
  verse: number;
  label: string;
  /** Scroll da lista Référence no momento do salto. */
  refsScrollTop: number;
  /** Scroll do scroller de passagem (leitura) no momento do salto. */
  passageScrollTop: number;
  /** Painel a restaurar no retorno (default lógico: refs). */
  returnTo: StudyJumpReturnTo;
};

/** Overlay a abrir após o capítulo origem carregar. */
export function studyJumpReturnOverlay(
  step: Pick<StudyJumpStep, "returnTo" | "verse">,
):
  | { type: "verse_actions"; selectedVerseIds: string[] }
  | { type: "history" }
  | { type: "marks" }
  | { type: "word_search" } {
  switch (step.returnTo) {
    case "history":
      return { type: "history" };
    case "marks":
      return { type: "marks" };
    case "word_search":
      return { type: "word_search" };
    case "refs":
    default:
      return {
        type: "verse_actions",
        selectedVerseIds: [String(step.verse)],
      };
  }
}

/** Restauração diferida de Options → Référence após o capítulo origem carregar. */
export type PendingStudyReturn = {
  step: StudyJumpStep;
};

export function pushStudyJumpStep(
  stack: readonly StudyJumpStep[],
  step: StudyJumpStep,
): StudyJumpStep[] {
  return [...stack, step];
}

export function popStudyJumpStep(stack: readonly StudyJumpStep[]): {
  stack: StudyJumpStep[];
  removed: StudyJumpStep | null;
} {
  if (!stack.length) return { stack: [...stack], removed: null };
  const removed = stack[stack.length - 1]!;
  return { stack: stack.slice(0, -1), removed };
}

export function clearStudyJumpSteps(): StudyJumpStep[] {
  return [];
}

export function studyJumpTop(
  stack: readonly StudyJumpStep[],
): StudyJumpStep | null {
  return stack.length ? stack[stack.length - 1]! : null;
}

export function useStudyJumpStack() {
  const [stack, setStack] = useState<StudyJumpStep[]>([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const push = useCallback((step: StudyJumpStep) => {
    setStack((prev) => {
      const next = pushStudyJumpStep(prev, step);
      stackRef.current = next;
      return next;
    });
  }, []);

  const pop = useCallback((): StudyJumpStep | null => {
    const { stack: next, removed } = popStudyJumpStep(stackRef.current);
    stackRef.current = next;
    setStack(next);
    return removed;
  }, []);

  const clear = useCallback(() => {
    const next = clearStudyJumpSteps();
    stackRef.current = next;
    setStack(next);
  }, []);

  const top = useMemo(() => studyJumpTop(stack), [stack]);

  return {
    stack,
    top,
    depth: stack.length,
    push,
    pop,
    clear,
  };
}
