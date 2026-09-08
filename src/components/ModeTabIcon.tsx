import {
  BookOpenIcon as BookOutline,
  CalendarDaysIcon as CalendarDaysOutline,
  DocumentTextIcon as DocumentOutline,
  InboxIcon as InboxOutline,
  RectangleStackIcon as StackOutline,
} from "@heroicons/react/24/outline";
import {
  BookOpenIcon as BookSolid,
  CalendarDaysIcon as CalendarDaysSolid,
  DocumentTextIcon as DocumentSolid,
  InboxIcon as InboxSolid,
  RectangleStackIcon as StackSolid,
} from "@heroicons/react/24/solid";

type ModeTabName = "today" | "bible" | "cards" | "inbox" | "calendar";

type ModeTabIconProps = {
  name: ModeTabName;
  active?: boolean;
};

/** Thème ≈ Página StudyOS (DocumentText). */
const ICONS: Record<
  ModeTabName,
  {
    Outline: typeof DocumentOutline;
    Solid: typeof DocumentSolid;
  }
> = {
  today: { Outline: DocumentOutline, Solid: DocumentSolid },
  bible: { Outline: BookOutline, Solid: BookSolid },
  cards: { Outline: StackOutline, Solid: StackSolid },
  inbox: { Outline: InboxOutline, Solid: InboxSolid },
  calendar: { Outline: CalendarDaysOutline, Solid: CalendarDaysSolid },
};

export function ModeTabIcon({ name, active = false }: ModeTabIconProps) {
  const { Outline, Solid } = ICONS[name];
  const Icon = active ? Solid : Outline;
  return (
    <Icon
      className={`mode-tab-icon${active ? " is-filled" : ""}`}
      width={18}
      height={18}
      aria-hidden
    />
  );
}
