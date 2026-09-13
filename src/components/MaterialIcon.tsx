type MaterialIconProps = {
  name: string;
  className?: string;
  filled?: boolean;
  /** Optical size hint for Material Symbols (default 24). */
  opsz?: 20 | 24 | 40 | 48;
};

/** Google Material Symbols Outlined (font carregada em index.html). */
export function MaterialIcon({
  name,
  className = "",
  filled = false,
  opsz = 24,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ""}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${opsz}`,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
