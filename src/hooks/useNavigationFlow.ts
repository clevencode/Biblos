/**
 * Bridge React fino — Navigation Flow Engine ↔ leitor Biblos.
 * Sem lógica de domínio aqui; só ciclo de vida + subscribe.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { YouVersionBook } from "../youversion/client";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import {
  bookCodeToId,
  buildBiblosManifest,
  createBiblosPassageAdapter,
  createNavigationFlowEngine,
  encodeUsfmId,
  type NavigationFlowEngine,
  type NavigationStateSnapshot,
} from "../bible/navigation-flow";

export type UseNavigationFlowOptions = {
  enabled?: boolean;
  books: YouVersionBook[];
  version: BibleTextVersionId;
  bookId: string;
  chapterId: string;
  verse?: number | null;
};

export function useNavigationFlow(options: UseNavigationFlowOptions): {
  engine: NavigationFlowEngine | null;
  state: NavigationStateSnapshot | null;
} {
  const {
    enabled = true,
    books,
    version,
    bookId,
    chapterId,
    verse = 1,
  } = options;

  const engineRef = useRef<NavigationFlowEngine | null>(null);
  const [state, setState] = useState<NavigationStateSnapshot | null>(null);

  const manifest = useMemo(() => buildBiblosManifest(books), [books]);

  useEffect(() => {
    if (!enabled || manifest.length === 0) {
      engineRef.current = null;
      setState(null);
      return;
    }

    const numericBook = bookCodeToId(bookId) ?? 1;
    const chapter = Math.max(1, Number(chapterId) || 1);
    const v = Math.max(1, Number(verse) || 1);
    const initialUsfmId = encodeUsfmId(numericBook, chapter, v);

    const engine = createNavigationFlowEngine({
      adapter: createBiblosPassageAdapter(() => version),
      manifest,
      initialVersion: version,
      initialUsfmId,
    });
    engineRef.current = engine;
    const unsub = engine.subscribe(setState);
    return () => {
      unsub();
      engineRef.current = null;
    };
    // Remonta quando manifesto/versão base mudam — sync fino de capítulo via effect abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, manifest, version]);

  // Sync externo (leitor mudou livro/capítulo) → jumpTo sem empilhar.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !enabled) return;
    const numericBook = bookCodeToId(bookId);
    if (numericBook == null) return;
    const chapter = Math.max(1, Number(chapterId) || 1);
    const v = Math.max(1, Number(verse) || 1);
    const target = encodeUsfmId(numericBook, chapter, v);
    const cur = engine.getState().usfmId;
    if (cur === target) return;
    void engine.jumpTo(target);
  }, [enabled, bookId, chapterId, verse]);

  // Troca de versão preservando âncora.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !enabled) return;
    if (engine.getState().version === version) return;
    void engine.switchVersion(version);
  }, [enabled, version]);

  return { engine: engineRef.current, state };
}
