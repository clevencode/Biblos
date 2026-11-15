import type { PassagePresentation } from "./selectors";
import type { PassageLayoutSchema } from "./types";

/** Estado de carregamento do passo versículo no picker (espelha PassagePresentation). */
export type PassagePickerChrome = {
  inFlight: boolean;
  showDeferredUi: boolean;
  schema: PassageLayoutSchema | null;
};

export function passagePickerChrome(input: {
  inFlight: boolean;
  showDeferredUi: boolean;
  schema: PassageLayoutSchema | null;
}): PassagePickerChrome {
  return {
    inFlight: input.inFlight,
    showDeferredUi: input.showDeferredUi,
    schema: input.schema,
  };
}

export function passagePickerChromeFromPresentation(
  presentation: PassagePresentation,
  schema: PassageLayoutSchema | null,
): PassagePickerChrome {
  return passagePickerChrome({
    inFlight: presentation.inFlight,
    showDeferredUi: presentation.showDeferredUi,
    schema,
  });
}
