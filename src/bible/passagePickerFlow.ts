/**
 * Após escolher capítulo no roll: `test` fecha o picker (sem passo Verset).
 * `legacy` | `verse` | `0` mantém a grelha de versículos.
 */
export function passagePickerSkipsVerseStep(): boolean {
  const raw = String(import.meta.env.VITE_PASSAGE_PICKER_FLOW ?? "test")
    .trim()
    .toLowerCase();
  return raw !== "legacy" && raw !== "verse" && raw !== "0";
}
