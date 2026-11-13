/**
 * Locale da UI = idioma da versão bíblica ativa (s21→fr, ht98→ht).
 */

import {
  readBibleTextVersionPref,
  type BibleTextVersionId,
} from "../bible/bibleVersions";

export type UiLocale = "fr" | "ht";

export const UI_LOCALE_EVENT = "biblos-ui-locale";

export function uiLocaleFromVersion(versionId: BibleTextVersionId): UiLocale {
  return versionId === "ht98" ? "ht" : "fr";
}

/** Idioma UI → versão bíblica (fr→s21, ht→ht98). */
export function versionIdFromUiLocale(locale: UiLocale): BibleTextVersionId {
  return locale === "ht" ? "ht98" : "s21";
}

export function readUiLocaleFromPrefs(): UiLocale {
  return uiLocaleFromVersion(readBibleTextVersionPref());
}

export function dateLocaleTag(locale: UiLocale): string {
  return locale === "ht" ? "ht-HT" : "fr-FR";
}

/** Notifica a app após troca de versão bíblica (prefs já gravadas). */
export function notifyUiLocale(versionId: BibleTextVersionId): void {
  const locale = uiLocaleFromVersion(versionId);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(UI_LOCALE_EVENT, { detail: { locale, versionId } }),
  );
}

export function subscribeUiLocale(
  onChange: (locale: UiLocale, versionId: BibleTextVersionId) => void,
): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ locale: UiLocale; versionId: BibleTextVersionId }>)
      .detail;
    if (!detail?.locale) return;
    onChange(detail.locale, detail.versionId);
  };
  window.addEventListener(UI_LOCALE_EVENT, handler);
  return () => window.removeEventListener(UI_LOCALE_EVENT, handler);
}
