import type { IconComponent } from "@coolicons/react/line/round";
import {
  Bell,
  BellDot,
  Bookmark,
  BookmarkMinus,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Close,
  Copy,
  Download,
  Highlighter,
  History,
  Menu,
  Monitor,
  Moon,
  Pause,
  Play,
  Reload,
  Search,
  Settings,
  Share,
  Sun,
  SunMoon,
  Trash,
  User,
} from "@coolicons/react/line/round";
import {
  BellDot as BellDotFill,
  CircleCheck as CircleCheckFill,
  Pause as PauseFill,
  Play as PlayFill,
} from "@coolicons/react/fill/round";

/** Nomes estáveis usados no app (legado Material ligature → coolicons). */
export type BiblosIconName =
  | "close"
  | "content_copy"
  | "ios_share"
  | "chevron_left"
  | "chevron_right"
  | "menu"
  | "search"
  | "light_mode"
  | "dark_mode"
  | "routine"
  | "check_circle"
  | "download"
  | "history"
  | "style"
  | "bookmark"
  | "bookmark_remove"
  | "pause"
  | "play_arrow"
  | "check"
  | "person"
  | "settings"
  | "delete"
  | "sync"
  | "notifications"
  | "notifications_active"
  | "desktop_windows";

type IconEntry = {
  line: IconComponent;
  /** Quando `filled` no wrapper, prefere este glifo (estilo fill). */
  fill?: IconComponent;
};

export const ICON_REGISTRY: Record<BiblosIconName, IconEntry> = {
  close: { line: Close },
  content_copy: { line: Copy },
  ios_share: { line: Share },
  chevron_left: { line: ChevronLeft },
  chevron_right: { line: ChevronRight },
  menu: { line: Menu },
  search: { line: Search },
  light_mode: { line: Sun },
  dark_mode: { line: Moon },
  routine: { line: SunMoon },
  check_circle: { line: CircleCheck, fill: CircleCheckFill },
  download: { line: Download },
  history: { line: History },
  style: { line: Highlighter },
  bookmark: { line: Bookmark },
  bookmark_remove: { line: BookmarkMinus },
  pause: { line: Pause, fill: PauseFill },
  play_arrow: { line: Play, fill: PlayFill },
  check: { line: Check },
  person: { line: User },
  settings: { line: Settings },
  delete: { line: Trash },
  sync: { line: Reload },
  notifications: { line: Bell, fill: BellDotFill },
  notifications_active: { line: BellDot, fill: BellDotFill },
  desktop_windows: { line: Monitor },
};

export function isBiblosIconName(name: string): name is BiblosIconName {
  return Object.prototype.hasOwnProperty.call(ICON_REGISTRY, name);
}
