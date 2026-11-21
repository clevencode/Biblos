import type { IconComponent } from "@coolicons/react/line/round";
import { Book, Layers } from "@coolicons/react/line/round";
import {
  Book as BookFill,
  Layers as LayersFill,
} from "@coolicons/react/fill/round";
import { ICON_STROKE_WIDTH, TAB_ICON_PX } from "../icons/config";
import type { ShellTab } from "../shellNav";

type ModeTabIconProps = {
  name: ShellTab;
  active?: boolean;
};

type TabIconEntry = {
  line: IconComponent;
  fill: IconComponent;
};

const TAB_ICONS: Record<ShellTab, TabIconEntry> = {
  /** Plano de leitura — camadas / livros empilhados (estilo colecção). */
  plan: { line: Layers, fill: LayersFill },
  bible: { line: Book, fill: BookFill },
};

export function ModeTabIcon({ name, active = false }: ModeTabIconProps) {
  const entry = TAB_ICONS[name];
  const Glyph = active ? entry.fill : entry.line;

  return (
    <Glyph
      className={`mode-tab-icon yv-icon${active ? " is-active" : ""}`}
      size="1em"
      strokeWidth={ICON_STROKE_WIDTH}
      style={{ fontSize: TAB_ICON_PX }}
      aria-hidden
    />
  );
}
