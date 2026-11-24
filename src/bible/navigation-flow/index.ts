export type {
  BookManifest,
  HistoryEntry,
  JumpOptions,
  NavigationDataAdapter,
  NavigationFlowEngine,
  NavigationListener,
  NavigationMode,
  NavigationStateSnapshot,
  VerseNode,
} from "./contracts/navigation.contract";

export {
  bookCodeToId,
  bookIdToCode,
  decodeUsfmId,
  encodeUsfmId,
  formatUsfmRef,
  parseUsfmRef,
  registerExtraBook,
  chapterStartUsfmId,
} from "./core/usfm.codec";

export {
  adjacentChapterStart,
  buildManifestIndex,
  clampUsfmId,
  isValidUsfmId,
  labelForUsfmId,
} from "./core/manifest.resolver";

export { createNavigationFlowEngine } from "./core/navigation.machine";
export type { CreateNavigationEngineOptions } from "./core/navigation.machine";

export { SlidingWindowCache } from "./cache/sliding.window";

export {
  buildBiblosManifest,
  buildCanonFallbackManifest,
  createBiblosPassageAdapter,
} from "./adapters/biblosPassageAdapter";
