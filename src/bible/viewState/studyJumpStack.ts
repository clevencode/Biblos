import { useCallback, useMemo, useRef, useState } from "react";

/** Passo empilhado antes de Aller au verset / chapitre. */
export type StudyJumpStep = {
  bookId: string;
  chapterId: string;
  verse: number;
  label: string;
  refsScrollTop: number;
};

/** Restauração diferida de Options → Référence após o capítulo origem carregar. */
export type PendingStudyReturn = {
  step: StudyJumpStep;
};

export function useStudyJumpStack() {
  const [stack, setStack] = useState<StudyJumpStep[]>([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const push = useCallback((step: StudyJumpStep) => {
    setStack((prev) => {
      const next = [...prev, step];
      stackRef.current = next;
      return next;
    });
  }, []);

  const pop = useCallback((): StudyJumpStep | null => {
    const prev = stackRef.current;
    if (!prev.length) return null;
    const removed = prev[prev.length - 1]!;
    const next = prev.slice(0, -1);
    stackRef.current = next;
    setStack(next);
    return removed;
  }, []);

  const clear = useCallback(() => {
    stackRef.current = [];
    setStack([]);
  }, []);

  const top = useMemo(
    () => (stack.length ? stack[stack.length - 1]! : null),
    [stack],
  );

  return {
    stack,
    top,
    depth: stack.length,
    push,
    pop,
    clear,
  };
}
