/**
 * Escala discreta Aa (YouVersion / Kindle) — 5 âncoras.
 * Default = meio (19).
 */
export const BIBLE_FONT_SIZE_STEPS = [15, 17, 19, 23, 28] as const;

export type BibleFontSizeStep = (typeof BIBLE_FONT_SIZE_STEPS)[number];

export const BIBLE_FONT_SIZE_MIN = BIBLE_FONT_SIZE_STEPS[0];
export const BIBLE_FONT_SIZE_MAX =
  BIBLE_FONT_SIZE_STEPS[BIBLE_FONT_SIZE_STEPS.length - 1];
export const BIBLE_FONT_SIZE_DEFAULT: BibleFontSizeStep = 19;

export function bibleFontSizeIndex(size: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < BIBLE_FONT_SIZE_STEPS.length; i++) {
    const dist = Math.abs(BIBLE_FONT_SIZE_STEPS[i]! - size);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export function nearestBibleFontSize(size: number): BibleFontSizeStep {
  return BIBLE_FONT_SIZE_STEPS[bibleFontSizeIndex(size)]!;
}

export function bibleFontSizeAt(index: number): BibleFontSizeStep {
  const i = Math.max(0, Math.min(BIBLE_FONT_SIZE_STEPS.length - 1, index));
  return BIBLE_FONT_SIZE_STEPS[i]!;
}

/** ±1 âncora a partir do tamanho actual. */
export function stepBibleFontSize(size: number, delta: number): BibleFontSizeStep {
  return bibleFontSizeAt(bibleFontSizeIndex(size) + Math.trunc(delta));
}
