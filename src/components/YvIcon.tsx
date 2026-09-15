import type { LucideIcon, LucideProps } from "lucide-react";
import {
  BookOpen,
  Bookmark,
  BookmarkX,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Contrast,
  Download,
  History,
  Home,
  Layers,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Search,
  Sun,
  User,
} from "lucide-react";

type YvIconProps = {
  name: string;
  className?: string;
  /** Filled glyph for active / primary controls. */
  filled?: boolean;
  /** Optical size (maps to Lucide `size`, default 24). */
  opsz?: 20 | 24 | 40 | 48;
};

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  calendar_month: CalendarDays,
  menu_book: BookOpen,
  style: Layers,
  person: User,
  search: Search,
  more_horiz: MoreHorizontal,
  light_mode: Sun,
  dark_mode: Moon,
  routine: Contrast,
  check_circle: CircleCheck,
  download: Download,
  history: History,
  bookmark: Bookmark,
  bookmark_remove: BookmarkX,
  play_arrow: Play,
  pause: Pause,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  check: Check,
};

/** Icons that read well as solid fills (not just heavier stroke). */
const SOLID_FILL = new Set([
  "home",
  "person",
  "bookmark",
  "play_arrow",
  "pause",
]);

/** App icons via Lucide (compat API with former Material Symbol names). */
export function YvIcon({
  name,
  className = "",
  filled = false,
  opsz = 24,
}: YvIconProps) {
  const Icon = ICONS[name];
  if (!Icon) return null;

  const solid = filled && SOLID_FILL.has(name);
  const media = name === "play_arrow" || name === "pause";

  const props: LucideProps = {
    className: `yv-icon${className ? ` ${className}` : ""}`,
    size: opsz,
    strokeWidth: solid && media ? 0 : filled ? 2.25 : 1.75,
    absoluteStrokeWidth: true,
    "aria-hidden": true,
  };

  if (solid) {
    props.fill = "currentColor";
  }

  return <Icon {...props} />;
}
