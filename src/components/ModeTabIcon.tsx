import type { CenterMode } from "../types";
import { YvIcon } from "./YvIcon";

type ModeTabIconProps = {
  name: CenterMode;
  active?: boolean;
};

/** Tab icons aligned with YouVersion Bible (menu_book, home, person, etc.). */
const ICONS: Record<CenterMode, string> = {
  home: "home",
  today: "calendar_month",
  bible: "menu_book",
  cards: "style",
  profile: "person",
};

export function ModeTabIcon({ name, active = false }: ModeTabIconProps) {
  return (
    <YvIcon
      name={ICONS[name]}
      filled={active}
      className={`mode-tab-icon${active ? " is-filled" : ""}`}
      opsz={24}
    />
  );
}
