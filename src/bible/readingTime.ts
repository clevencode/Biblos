/**
 * Tempo estimado de leitura de um capítulo.
 *
 * Padrão: palavras ÷ palavras-por-minuto, arredondado para cima, mínimo 1 min.
 * Taxas de leitura silenciosa por idioma — IReST (Trauzettel-Klosinski &
 * Dietz, 2012, IOVS 53:5452): francês ≈ 195 ppm. O crioulo haitiano não
 * consta do estudo; usa a taxa do francês (léxico de base francesa).
 */
const WORDS_PER_MINUTE: Record<string, number> = {
  fr: 195,
  ht: 195,
  en: 228,
  pt: 181,
  es: 218,
};

const DEFAULT_WORDS_PER_MINUTE = 200;

const WORD_FALLBACK_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

type WordSegmenter = {
  segment: (text: string) => Iterable<{ isWordLike?: boolean }>;
};

const segmenterCache = new Map<string, WordSegmenter | null>();

function wordSegmenter(languageCode: string): WordSegmenter | null {
  if (segmenterCache.has(languageCode)) return segmenterCache.get(languageCode)!;
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locale: string,
        options: { granularity: "word" },
      ) => WordSegmenter;
    }
  ).Segmenter;
  let segmenter: WordSegmenter | null = null;
  try {
    segmenter = Segmenter ? new Segmenter(languageCode, { granularity: "word" }) : null;
  } catch {
    segmenter = null;
  }
  segmenterCache.set(languageCode, segmenter);
  return segmenter;
}

export function countWords(text: string, languageCode = "fr"): number {
  if (!text) return 0;
  const segmenter = wordSegmenter(languageCode);
  if (!segmenter) return text.match(WORD_FALLBACK_RE)?.length ?? 0;
  let count = 0;
  for (const segment of segmenter.segment(text)) {
    if (segment.isWordLike) count += 1;
  }
  return count;
}

/** Minutos estimados (inteiro ≥ 1), ou `null` sem texto. */
export function estimateReadingMinutes(
  texts: readonly string[],
  languageCode = "fr",
): number | null {
  let words = 0;
  for (const text of texts) words += countWords(text, languageCode);
  if (words === 0) return null;
  const wpm = WORDS_PER_MINUTE[languageCode] ?? DEFAULT_WORDS_PER_MINUTE;
  return Math.max(1, Math.ceil(words / wpm));
}
