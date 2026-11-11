/**
 * Compat: reexporta o cache multi-versão (chave s21).
 * Preferir `verseIndexCache`.
 */

export {
  ensureS21VerseIndex,
  ensureVerseIndex,
  invalidateS21VerseIndex,
  invalidateVerseIndex,
} from "./verseIndexCache";
