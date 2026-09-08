/** Detecta se um lembrete / cartão aponta para uma passagem bíblica. */
import { isPassageRef } from "./youversion/usfm";

export function isPassageReminder(
  title: string,
  cardCategory?: string | null,
): boolean {
  if (String(cardCategory || "").toUpperCase() === "VERSECARD") return true;
  return isPassageRef(title);
}
