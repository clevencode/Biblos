import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  writeBibleTextVersionPref,
  type BibleTextVersionId,
} from "../bible/bibleVersions";
import {
  formatUiCopy,
  uiCopy,
  type UiCopyKey,
} from "./uiCopy";
import {
  dateLocaleTag,
  notifyUiLocale,
  readUiLocaleFromPrefs,
  subscribeUiLocale,
  uiLocaleFromVersion,
  versionIdFromUiLocale,
  type UiLocale,
} from "./uiLocale";

export type UiTranslate = (
  key: UiCopyKey,
  vars?: Record<string, string | number>,
) => string;

type UiLocaleContextValue = {
  locale: UiLocale;
  dateLocale: string;
  t: UiTranslate;
  /** Após gravar prefs da versão bíblica. */
  setVersionDrivenLocale: (versionId: BibleTextVersionId) => void;
  /** Preferências: idioma → grava versão bíblica + atualiza UI. */
  setLocaleWithBibleVersion: (locale: UiLocale) => void;
};

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null);

export function UiLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<UiLocale>(() => readUiLocaleFromPrefs());

  useEffect(() => subscribeUiLocale((next) => setLocale(next)), []);

  const setVersionDrivenLocale = useCallback((versionId: BibleTextVersionId) => {
    setLocale(uiLocaleFromVersion(versionId));
    notifyUiLocale(versionId);
  }, []);

  const setLocaleWithBibleVersion = useCallback((next: UiLocale) => {
    const versionId = versionIdFromUiLocale(next);
    writeBibleTextVersionPref(versionId);
    setLocale(next);
    notifyUiLocale(versionId);
  }, []);

  const t = useCallback<UiTranslate>(
    (key, vars) => formatUiCopy(uiCopy(locale)[key], vars),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      dateLocale: dateLocaleTag(locale),
      t,
      setVersionDrivenLocale,
      setLocaleWithBibleVersion,
    }),
    [locale, t, setVersionDrivenLocale, setLocaleWithBibleVersion],
  );

  return (
    <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>
  );
}

export function useUiLocale(): UiLocaleContextValue {
  const ctx = useContext(UiLocaleContext);
  if (!ctx) {
    throw new Error("useUiLocale must be used within UiLocaleProvider");
  }
  return ctx;
}
