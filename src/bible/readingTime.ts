/**
 * Tempo estimado de leitura de um capítulo.
 *
 * Padrão: palavras ÷ palavras-por-minuto, arredondado para cima, mínimo 1 min.
 * Taxas de leitura silenciosa por idioma — IReST (Trauzettel-Klosinski &
 * Dietz, 2012, IOVS 53:5452): francês ≈ 195 ppm. O crioulo haitiano não
 * consta do estudo; usa a taxa do francês (léxico de base francesa).
 *
 * Contagem por regex Unicode (letras/dígitos, com elisões e hífens): ~2×
 * mais rápida que `Intl.Segmenter` e sem a carga fria dos dados ICU no
 * primeiro capítulo; diferença < 1% nas contagens, invisível após o
 * arredondamento a minutos.
 */
const WORDS_PER_MINUTE: Record<string, number> = {
  fr: 195,
  ht: 195,
  en: 228,
  pt: 181,
  es: 218,
};

const DEFAULT_WORDS_PER_MINUTE = 200;

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  return text ? (text.match(WORD_RE)?.length ?? 0) : 0;
}

/** Minutos estimados (inteiro ≥ 1), ou `null` sem texto. */
export function estimateReadingMinutes(
  texts: readonly string[],
  languageCode = "fr",
): number | null {
  let words = 0;
  for (const text of texts) words += countWords(text);
  if (words === 0) return null;
  const wpm = WORDS_PER_MINUTE[languageCode] ?? DEFAULT_WORDS_PER_MINUTE;
  return Math.max(1, Math.ceil(words / wpm));
}
