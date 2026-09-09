/** Detecta se um lembrete / cartão aponta para uma passagem bíblica. */
import { isPassageRef } from "./youversion/usfm";

export function isPassageReminder(
  title: string,
  _cardCategory?: string | null,
): boolean {
  return isPassageRef(title);
}
