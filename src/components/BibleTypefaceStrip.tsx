import { memo, startTransition, useCallback } from "react";
import { useUiLocale } from "../i18n/UiLocaleContext";
import {
  BIBLE_FONT_OPTIONS,
  ensureBibleFontLoaded,
  type BibleFontId,
} from "../typography/bibleFonts";

type BibleTypefaceStripProps = {
  selected: BibleFontId;
  onSelect: (id: BibleFontId) => void;
};

/**
 * Chips Aa — seleção em `startTransition` + load lazy da face.
 */
export const BibleTypefaceStrip = memo(function BibleTypefaceStrip({
  selected,
  onSelect,
}: BibleTypefaceStripProps) {
  const { t } = useUiLocale();

  const pick = useCallback(
    (id: BibleFontId) => {
      if (id === selected) return;
      void ensureBibleFontLoaded(id);
      startTransition(() => onSelect(id));
    },
    [onSelect, selected],
  );

  return (
    <div
      className="bible-yv-tools-typeface"
      role="group"
      aria-label={t("bible.fontChoose")}
    >
      <span className="bible-yv-tools-typeface-label">{t("bible.fontChoose")}</span>
      <div className="bible-yv-typeface-strip">
        {BIBLE_FONT_OPTIONS.map((font) => {
          const active = selected === font.id;
          return (
            <button
              key={font.id}
              type="button"
              data-font={font.id}
              className={`bible-yv-typeface-chip${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => pick(font.id)}
            >
              <span className="bible-yv-typeface-chip-name">
                {t(font.labelKey)}
              </span>
              <span className="bible-yv-typeface-chip-desc">
                {t(font.descKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
