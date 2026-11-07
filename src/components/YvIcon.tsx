import { ICON_STROKE_WIDTH } from "../icons/config";
import {
  ICON_REGISTRY,
  isBiblosIconName,
  type BiblosIconName,
} from "../icons/registry";

type YvIconProps = {
  name: BiblosIconName | string;
  className?: string;
  /** Variante preenchida (controles primários / estado activo). */
  filled?: boolean;
  /** Tamanho óptico em px (default 24). */
  opsz?: 20 | 24 | 40 | 48;
};

/**
 * Ícones de interface — facade sobre [coolicons](https://coolicons.cool) (`line` + `round`).
 * Tab bar: `ModeTabIcon` (mesmo pacote, variante fill quando activo).
 */
export function YvIcon({
  name,
  className = "",
  filled = false,
  opsz = 24,
}: YvIconProps) {
  if (!isBiblosIconName(name)) {
    if (import.meta.env.DEV) {
      console.warn(`[YvIcon] ícone desconhecido: "${name}"`);
    }
    return null;
  }

  const entry = ICON_REGISTRY[name];
  const Glyph = (filled && entry.fill) || entry.line;

  return (
    <Glyph
      className={`yv-icon${className ? ` ${className}` : ""}`}
      size="1em"
      strokeWidth={ICON_STROKE_WIDTH}
      style={opsz === 24 ? undefined : { fontSize: opsz }}
      aria-hidden
    />
  );
}

export type { BiblosIconName };
