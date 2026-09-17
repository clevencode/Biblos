type YvIconProps = {
  name: string;
  className?: string;
  /** Filled glyph (active / primary controls). */
  filled?: boolean;
  /** Optical size hint for Material Symbols (default 24). */
  opsz?: 20 | 24 | 40 | 48;
};

/** Material Symbols Rounded — ligature name + FILL/opsz variation. */
export function YvIcon({
  name,
  className = "",
  filled = false,
  opsz = 24,
}: YvIconProps) {
  return (
    <span
      className={`yv-icon${className ? ` ${className}` : ""}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${opsz}`,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
