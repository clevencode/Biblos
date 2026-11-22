export type PassageDiscoverySession = {
  expandedBookId: string | null;
  verseScrollByBook: Record<string, number>;
  /** Dernier verset choisi — ancre visuelle au réouverture. */
  anchorVerseUsfm: string | null;
};

export const EMPTY_PASSAGE_DISCOVERY_SESSION: PassageDiscoverySession = {
  expandedBookId: null,
  verseScrollByBook: {},
  anchorVerseUsfm: null,
};
