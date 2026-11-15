import type { PassagePresentation } from "./selectors";
import type { PassageLayoutSchema } from "./types";

/** Estado de carregamento do passo versículo no picker (espelha PassagePresentation). */
export type PassagePickerChrome = {
  inFlight: boolean;
  schema: PassageLayoutSchema | null;
};

export function passagePickerChrome(input: {
  inFlight: boolean;
  schema: PassageLayoutSchema | null;
}): PassagePickerChrome {
  return {
    inFlight: input.inFlight,
    schema: input.schema,
  };
}

export function passagePickerChromeFromPresentation(
  presentation: PassagePresentation,
  schema: PassageLayoutSchema | null,
): PassagePickerChrome {
  return passagePickerChrome({
    inFlight: presentation.inFlight,
    schema,
  });
}
