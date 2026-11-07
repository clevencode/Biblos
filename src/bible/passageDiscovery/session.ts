export type PassageDiscoverySession = {
  expandedBookId: string | null;
  listScrollTop: number;
  verseScrollByBook: Record<string, number>;
  /** Dernier verset choisi — ancre visuelle au réouverture. */
  anchorVerseUsfm: string | null;
};

export const EMPTY_PASSAGE_DISCOVERY_SESSION: PassageDiscoverySession = {
  expandedBookId: null,
  listScrollTop: 0,
  verseScrollByBook: {},
  anchorVerseUsfm: null,
};
