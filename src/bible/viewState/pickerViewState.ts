export type GridSkeletonSchema = {
  slotIds: readonly string[];
};

export const PICKER_DISCOVERY_SKELETON_BOOKS = 4;
export const PICKER_DISCOVERY_VERSE_ROWS = 5;
export const PICKER_CHAPTER_FALLBACK_SLOTS = 20;

export function buildGridSkeletonSlotIds(
  prefix: string,
  count: number,
  from = 1,
): GridSkeletonSchema {
  const n = Math.max(1, Math.min(count, 60));
  return {
    slotIds: Array.from({ length: n }, (_, i) => `${prefix}:${from + i}`),
  };
}

export function buildChapterPickerSkeleton(bookId: string, count = PICKER_CHAPTER_FALLBACK_SLOTS) {
  return buildGridSkeletonSlotIds(`skeleton-chapter:${bookId.toUpperCase()}`, count, 1);
}

export function buildVersePickerSkeleton(usfm: string, count: number) {
  return buildGridSkeletonSlotIds(`skeleton-verse:${usfm.toUpperCase()}`, count, 1);
}

export function buildDiscoveryBookSkeleton() {
  return buildGridSkeletonSlotIds("skeleton-discovery-book", PICKER_DISCOVERY_SKELETON_BOOKS, 0);
}

export function buildDiscoveryVerseRowId(bookId: string, index: number): string {
  return `discovery-skel-${bookId.toUpperCase()}-${index + 1}`;
}
