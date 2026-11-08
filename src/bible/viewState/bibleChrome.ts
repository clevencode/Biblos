import type { BibleTextVersionId } from "../bibleVersions";
import type { CatalogViewState } from "./catalogViewState";

/** Chrome livre/capítulo — alinhado au catalogue (seed IDB) et HT98. */
export type BiblePickerChrome = {
  catalogReady: boolean;
  catalogLoading: boolean;
  chipsHydrating: boolean;
  pickerPanelOpenAllowed: boolean;
  controlsDisabled: boolean;
};

export function biblePickerChrome(input: {
  textVersion: BibleTextVersionId;
  catalog: CatalogViewState;
  htCatalogLoading: boolean;
  htBooksReady: boolean;
  passageInFlight: boolean;
}): BiblePickerChrome {
  const s21Loading = input.catalog.status === "loading";
  const s21Ready = input.catalog.status === "ready";

  const catalogLoading =
    input.textVersion === "ht98"
      ? input.htCatalogLoading || !input.htBooksReady
      : s21Loading;
  const catalogReady =
    input.textVersion === "ht98" ? input.htBooksReady && !input.htCatalogLoading : s21Ready;

  const chipsHydrating = catalogLoading || !catalogReady;

  return {
    catalogReady,
    catalogLoading,
    chipsHydrating,
    pickerPanelOpenAllowed: catalogReady && !catalogLoading,
    controlsDisabled: chipsHydrating || input.passageInFlight,
  };
}
