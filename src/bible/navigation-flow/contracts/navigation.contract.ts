/** Contratos públicos — Navigation Flow Engine (headless). */

export type NavigationMode = "canonical" | "reading-plan";

export interface BookManifest {
  /** Número canónico BB (1 = Génesis, 40 = Mateus, 70+ = extras). */
  bookId: number;
  /** Código USFM curto (GEN, 1EN, …). */
  code: string;
  name: string;
  direction: "ltr" | "rtl";
  /** Índice 0 = capítulo 1. */
  versesPerChapter: number[];
}

export interface VerseNode {
  /** Formato BBCCCVVV (ex.: 1001001 = GEN 1:1). */
  usfmId: number;
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
  crossRefs?: number[];
}

export interface HistoryEntry {
  version: string;
  usfmId: number;
  label: string;
  timestamp: number;
}

export interface NavigationDataAdapter {
  fetchChapter(
    version: string,
    bookId: number,
    chapter: number,
  ): Promise<VerseNode[]>;
}

export interface NavigationStateSnapshot {
  mode: NavigationMode;
  version: string;
  usfmId: number;
  bookId: number;
  chapter: number;
  verse: number;
  direction: "ltr" | "rtl";
  verses: VerseNode[];
  anchorUsfmId: number | null;
  crossRefDepth: number;
  requestSequenceId: number;
}

export type NavigationListener = (state: NavigationStateSnapshot) => void;

export interface JumpOptions {
  pushHistory?: boolean;
  label?: string;
}

export interface NavigationFlowEngine {
  jumpTo(usfmId: number, options?: JumpOptions): Promise<void>;
  stepChapter(direction: "next" | "prev"): Promise<void>;
  switchVersion(newVersion: string): Promise<void>;
  popCrossReference(): Promise<void>;
  updateScrollAnchor(topVisibleUsfmId: number): void;
  getState(): NavigationStateSnapshot;
  subscribe(listener: NavigationListener): () => void;
  setMode(mode: NavigationMode): void;
  /** Plano: sequência de usfmIds de capítulo (primeiro versículo de cada). */
  setReadingPlanSequence(chapterUsfmIds: number[]): void;
}
