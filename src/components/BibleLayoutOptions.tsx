import { memo, startTransition, useCallback } from "react";
import { useUiLocale } from "../i18n/UiLocaleContext";
import type { BibleDisplayMode, BibleTextAlign } from "../typography/bibleLayout";

type BibleLayoutOptionsProps = {
  textAlign: BibleTextAlign;
  displayMode: BibleDisplayMode;
  onTextAlign: (value: BibleTextAlign) => void;
  onDisplayMode: (value: BibleDisplayMode) => void;
};

/** Ícones mínimos (estilo YouVersion) — sem alargar o registry. */
function IconAlignLeft() {
  return (
    <svg className="bible-yv-layout-icon" viewBox="0 0 20 20" aria-hidden>
      <path
        fill="currentColor"
        d="M3 5h14v1.5H3V5zm0 4.25h10v1.5H3v-1.5zm0 4.25h14v1.5H3V13.5z"
      />
    </svg>
  );
}

function IconAlignJustify() {
  return (
    <svg className="bible-yv-layout-icon" viewBox="0 0 20 20" aria-hidden>
      <path
        fill="currentColor"
        d="M3 5h14v1.5H3V5zm0 4.25h14v1.5H3v-1.5zm0 4.25h14v1.5H3V13.5z"
      />
    </svg>
  );
}

function IconParagraphs() {
  return (
    <svg className="bible-yv-layout-icon" viewBox="0 0 20 20" aria-hidden>
      <path
        fill="currentColor"
        d="M4.5 4.5h7.2c1.9 0 3.3 1.3 3.3 3.1S13.6 10.7 11.7 10.7H8.6v5.3H7.1V6H4.5V4.5zm2.6 1.5v3.2h4.4c1.05 0 1.8-.65 1.8-1.6s-.75-1.6-1.8-1.6H7.1z"
      />
    </svg>
  );
}

function IconVerses() {
  return (
    <svg className="bible-yv-layout-icon" viewBox="0 0 20 20" aria-hidden>
      <path
        fill="currentColor"
        d="M3 4.75h14v1.4H3v-1.4zm0 4.55h14v1.4H3v-1.4zm0 4.55h14v1.4H3v-1.4z"
      />
    </svg>
  );
}

/**
 * Alignement + Affichage — grelha 2 colunas (gesto YouVersion).
 */
export const BibleLayoutOptions = memo(function BibleLayoutOptions({
  textAlign,
  displayMode,
  onTextAlign,
  onDisplayMode,
}: BibleLayoutOptionsProps) {
  const { t } = useUiLocale();

  const pickAlign = useCallback(
    (value: BibleTextAlign) => {
      if (value === textAlign) return;
      startTransition(() => onTextAlign(value));
    },
    [onTextAlign, textAlign],
  );

  const pickDisplay = useCallback(
    (value: BibleDisplayMode) => {
      if (value === displayMode) return;
      startTransition(() => onDisplayMode(value));
    },
    [displayMode, onDisplayMode],
  );

  return (
    <div className="bible-yv-tools-layout" role="group" aria-label={t("bible.text")}>
      <div className="bible-yv-layout-col" role="group" aria-label={t("bible.align")}>
        <span className="bible-yv-layout-col-label">{t("bible.align")}</span>
        <button
          type="button"
          className={`bible-yv-layout-option${textAlign === "left" ? " is-active" : ""}`}
          aria-pressed={textAlign === "left"}
          onClick={() => pickAlign("left")}
        >
          <IconAlignLeft />
          <span>{t("bible.alignLeft")}</span>
        </button>
        <button
          type="button"
          className={`bible-yv-layout-option${textAlign === "justify" ? " is-active" : ""}`}
          aria-pressed={textAlign === "justify"}
          onClick={() => pickAlign("justify")}
        >
          <IconAlignJustify />
          <span>{t("bible.alignJustify")}</span>
        </button>
      </div>
      <div className="bible-yv-layout-col" role="group" aria-label={t("bible.display")}>
        <span className="bible-yv-layout-col-label">{t("bible.display")}</span>
        <button
          type="button"
          className={`bible-yv-layout-option${displayMode === "paragraphs" ? " is-active" : ""}`}
          aria-pressed={displayMode === "paragraphs"}
          onClick={() => pickDisplay("paragraphs")}
        >
          <IconParagraphs />
          <span>{t("bible.displayParagraphs")}</span>
        </button>
        <button
          type="button"
          className={`bible-yv-layout-option${displayMode === "verses" ? " is-active" : ""}`}
          aria-pressed={displayMode === "verses"}
          onClick={() => pickDisplay("verses")}
        >
          <IconVerses />
          <span>{t("bible.displayVerses")}</span>
        </button>
      </div>
    </div>
  );
});
