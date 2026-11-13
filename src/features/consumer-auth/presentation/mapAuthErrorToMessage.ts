/**
 * Converte códigos Firebase Auth em mensagens FR/HT via uiCopy + locale das prefs.
 * Usável fora de UiLocaleProvider (ConsumerAuthProvider envolve o locale).
 */

import { uiCopy, type UiCopyKey } from "../../../i18n/uiCopy";
import { readUiLocaleFromPrefs } from "../../../i18n/uiLocale";

const AUTH_ERROR_KEYS: Record<string, UiCopyKey> = {
  "auth/invalid-credential": "auth.error.invalidCredential",
  "auth/wrong-password": "auth.error.wrongPassword",
  "auth/user-not-found": "auth.error.userNotFound",
  "auth/email-already-in-use": "auth.error.emailInUse",
  "auth/weak-password": "auth.error.weakPassword",
  "auth/too-many-requests": "auth.error.tooManyRequests",
  "auth/network-request-failed": "auth.error.network",
  "auth/popup-closed-by-user": "auth.error.popupClosed",
  "auth/cancelled-popup-request": "auth.error.popupClosed",
  "auth/invalid-email": "auth.error.invalidCredential",
};

function extractAuthCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  if ("code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  if (err instanceof Error) {
    const match = /auth\/[a-z0-9-]+/i.exec(err.message);
    return match ? match[0]!.toLowerCase() : null;
  }
  return null;
}

export function mapAuthErrorToMessage(err: unknown): string {
  const locale = readUiLocaleFromPrefs();
  const dict = uiCopy(locale);
  const code = extractAuthCode(err)?.toLowerCase() ?? null;
  const key =
    (code && AUTH_ERROR_KEYS[code]) || ("auth.error.generic" satisfies UiCopyKey);
  return dict[key];
}
