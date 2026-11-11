import type { IconComponent } from "@coolicons/react/line/round";
import { Book, House, Library, User } from "@coolicons/react/line/round";
import {
  Book as BookFill,
  House as HouseFill,
  Library as LibraryFill,
  User as UserFill,
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
  home: { line: House, fill: HouseFill },
  today: { line: Library, fill: LibraryFill },
  bible: { line: Book, fill: BookFill },
  profile: { line: User, fill: UserFill },
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
