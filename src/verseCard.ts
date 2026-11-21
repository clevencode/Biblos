/**
 * IDs estáveis de cartão de versículo (marcas / seleção no reader).
 */
import { toUsfm } from "./youversion/usfm";

function stableUsfmKey(frenteOrUsfm: string): string {
  const usfm = toUsfm(frenteOrUsfm)
    .replace(/[^A-Z0-9.-]/gi, "")
    .toUpperCase();
  return (usfm || frenteOrUsfm.trim().toUpperCase().replace(/\s+/g, "-")).slice(0, 48);
}

export function verseCardId(frenteOrUsfm: string): string {
  return `verse-${stableUsfmKey(frenteOrUsfm) || "card"}`;
}
