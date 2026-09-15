import type { CenterMode } from "../types";
import {
  BookOpen,
  CalendarDays,
  Home,
  Layers,
  User,
  type LucideIcon,
} from "lucide-react";

type ModeTabIconProps = {
  name: CenterMode;
  active?: boolean;
};

const ICONS: Record<CenterMode, LucideIcon> = {
  home: Home,
  today: CalendarDays,
  bible: BookOpen,
  cards: Layers,
  profile: User,
};

/** Solid fill reads well; open glyphs stay stroke-only when active. */
const SOLID_WHEN_ACTIVE = new Set<CenterMode>(["home", "profile"]);

/** Tab icons — Lucide, filled when the tab is active. */
export function ModeTabIcon({ name, active = false }: ModeTabIconProps) {
  const Icon = ICONS[name];
  const solid = active && SOLID_WHEN_ACTIVE.has(name);
  return (
    <Icon
      className={`yv-icon mode-tab-icon${active ? " is-filled" : ""}`}
      size={24}
      strokeWidth={active ? 2.25 : 1.75}
      absoluteStrokeWidth
      fill={solid ? "currentColor" : "none"}
      aria-hidden
    />
  );
}
