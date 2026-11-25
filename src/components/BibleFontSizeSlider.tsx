import {
  memo,
  startTransition,
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useUiLocale } from "../i18n/UiLocaleContext";
import {
  BIBLE_FONT_SIZE_MAX,
  BIBLE_FONT_SIZE_MIN,
  BIBLE_FONT_SIZE_STEPS,
  bibleFontSizeAt,
  bibleFontSizeIndex,
} from "../typography/bibleFontSize";

type BibleFontSizeSliderProps = {
  value: number;
  onChange: (size: number) => void;
  disabled?: boolean;
  /** Sem divisor superior (ex. perfil). */
  embed?: boolean;
};

/**
 * Barra Aa com âncoras discretas (gesto YouVersion / Kindle).
 */
export const BibleFontSizeSlider = memo(function BibleFontSizeSlider({
  value,
  onChange,
  disabled = false,
  embed = false,
}: BibleFontSizeSliderProps) {
  const { t } = useUiLocale();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const index = bibleFontSizeIndex(value);
  const stepCount = BIBLE_FONT_SIZE_STEPS.length;

  const commitIndex = useCallback(
    (nextIndex: number) => {
      const size = bibleFontSizeAt(nextIndex);
      if (size === nearestOf(value)) return;
      startTransition(() => onChange(size));
    },
    [onChange, value],
  );

  const indexFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (stepCount - 1));
  }, [stepCount]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    commitIndex(indexFromClientX(event.clientX));
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return;
    commitIndex(indexFromClientX(event.clientX));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      commitIndex(index - 1);
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      commitIndex(index + 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      commitIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      commitIndex(stepCount - 1);
    }
  };

  const thumbPct = stepCount <= 1 ? 0 : (index / (stepCount - 1)) * 100;

  return (
    <div
      className={`bible-yv-tools-font${embed ? " is-embed" : ""}`}
      role="group"
      aria-label={t("bible.fontSize")}
    >
      <span className="bible-yv-tools-font-label">{t("bible.text")}</span>
      <div className="bible-yv-font-slider">
        <span className="bible-yv-font-slider-mark is-min" aria-hidden>
          A
        </span>
        <div
          ref={trackRef}
          className={`bible-yv-font-slider-track${disabled ? " is-disabled" : ""}`}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={BIBLE_FONT_SIZE_MIN}
          aria-valuemax={BIBLE_FONT_SIZE_MAX}
          aria-valuenow={BIBLE_FONT_SIZE_STEPS[index]}
          aria-valuetext={`${BIBLE_FONT_SIZE_STEPS[index]}px`}
          aria-label={t("bible.fontSize")}
          aria-disabled={disabled || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          <span className="bible-yv-font-slider-line" aria-hidden />
          {BIBLE_FONT_SIZE_STEPS.map((size, i) => (
            <span
              key={size}
              className={`bible-yv-font-slider-dot${i === index ? " is-active" : ""}`}
              style={{ left: `${(i / (stepCount - 1)) * 100}%` }}
              aria-hidden
            />
          ))}
          <span
            className="bible-yv-font-slider-thumb"
            style={{ left: `${thumbPct}%` }}
            aria-hidden
          />
        </div>
        <span className="bible-yv-font-slider-mark is-max" aria-hidden>
          A
        </span>
      </div>
    </div>
  );
});

function nearestOf(size: number) {
  return BIBLE_FONT_SIZE_STEPS[bibleFontSizeIndex(size)]!;
}
