import type { CenterMode } from "../types";
import { MaterialIcon } from "./MaterialIcon";

type ModeTabIconProps = {
  name: CenterMode;
  active?: boolean;
};

const ICONS: Record<CenterMode, string> = {
  home: "home",
  today: "grid_view",
  bible: "menu_book",
  cards: "style",
  profile: "person",
};

export function ModeTabIcon({ name, active = false }: ModeTabIconProps) {
  return (
    <MaterialIcon
      name={ICONS[name]}
      filled={active}
      className={`mode-tab-icon${active ? " is-filled" : ""}`}
      opsz={24}
    />
  );
}
